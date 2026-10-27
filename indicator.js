// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

import * as EasyEffects from './easyeffects.js';

// Bundled so the icon also shows when Easy Effects is a Flatpak.
const ICON = Gio.FileIcon.new(Gio.File.new_for_uri(import.meta.url)
    .get_parent().resolve_relative_path('icons/easyeffects-symbolic.svg'));
const DESKTOP_FILE = 'com.github.wwmm.easyeffects.desktop';

// Switches bound to Easy Effects settings: [key, label, the setting of
// this extension that shows it].
const SETTING_SWITCHES = [
    ['process-all-outputs', 'Process all outputs', 'show-process-all-outputs'],
    ['process-all-inputs', 'Process all inputs', 'show-process-all-inputs'],
    ['inactivity-timer-enable', 'Pause when silent', 'show-pause-when-silent'],
];

// Easy Effects settings that change when its presets or bypass change,
// from this menu, its window or its command line client.
const STATE_KEYS = ['bypass', 'last-loaded-output-preset', 'last-loaded-input-preset'];

// Apps that record only to show the input level, as GNOME's own
// microphone indicator skips them.
const LEVEL_METER_APPS = ['org.gnome.VolumeControl', 'org.PulseAudio.pavucontrol'];

// A collapsible menu section with a status text before its arrow.
const SectionItem = GObject.registerClass(
class SectionItem extends PopupMenu.PopupSubMenuMenuItem {
    _init(text) {
        super._init(text);
        this._status = new St.Label({
            style_class: 'popup-status-menu-item',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.insert_child_below(this._status, this._triangleBin);
    }

    setStatus(text) {
        this._status.text = text;
    }
});

// The Quick Settings toggle. It is checked while Easy Effects runs;
// clicking it starts Easy Effects in the background, or opens its
// window when already running. Its menu has collapsible lists of the
// presets and of the apps playing or recording, switches for the global
// bypass and some Easy Effects settings, and an item to quit Easy
// Effects. The preferences pick which of those show. The menu follows Easy Effects
// and the apps as they change, also while it is open.
const PresetToggle = GObject.registerClass({
    Properties: {
        'bypassed': GObject.ParamSpec.boolean('bypassed', null, null,
            GObject.ParamFlags.READWRITE, false),
    },
}, class PresetToggle extends QuickMenuToggle {
    _init(prefs) {
        super._init({
            title: 'Easy Effects',
            gicon: ICON,
        });

        this.menu.setHeader(ICON, 'Easy Effects');

        this._prefs = prefs;
        this._settings = EasyEffects.getSettings(EasyEffects.SCHEMA);
        this._outputSettings = EasyEffects.getSettings(EasyEffects.OUTPUTS_SCHEMA);
        this._inputSettings = EasyEffects.getSettings(EasyEffects.INPUTS_SCHEMA);

        // Everything below the header only shows while Easy Effects runs.
        this._runningSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._runningSection);

        this._outputItem = new SectionItem('Output');
        this._inputItem = new SectionItem('Input');
        this._appsItem = new SectionItem('Apps');
        this._sectionItems = [this._outputItem, this._inputItem, this._appsItem];
        this._sectionItems.forEach(item => this._runningSection.addMenuItem(item));
        if (this._outputSettings && this._inputSettings)
            prefs.bind('show-apps', this._appsItem, 'visible', Gio.SettingsBindFlags.GET);
        else
            this._appsItem.visible = false;

        // Picking an item keeps Quick Settings open: GNOME closes it from
        // the itemActivated() of the menu holding the item.
        for (const menu of [this._runningSection, ...this._sectionItems.map(item => item.menu)])
            menu.itemActivated = () => {};

        const switchesSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._runningSection.addMenuItem(switchesSeparator);
        this._bypassItem = new PopupMenu.PopupSwitchMenuItem('Bypass', false);
        this._bypassItem.connect('toggled', (_item, state) => this._setBypassed(state));
        this._runningSection.addMenuItem(this._bypassItem);
        const switches = [[this._bypassItem, 'show-bypass']];
        if (this._settings) {
            for (const [key, label, showKey] of SETTING_SWITCHES) {
                const item = new PopupMenu.PopupSwitchMenuItem(label, false);
                this._settings.bind(key, item, 'state', Gio.SettingsBindFlags.DEFAULT);
                this._runningSection.addMenuItem(item);
                switches.push([item, showKey]);
            }
        }

        this._runningSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._runningSection.addAction('Quit Easy Effects', () => {
            Main.panel.closeQuickSettings();
            EasyEffects.quit();
        });

        // The separator above the switches only shows with one of them.
        const syncSeparator = () => {
            switchesSeparator.visible = switches.some(([item]) => item.visible);
        };
        for (const [item, showKey] of switches) {
            prefs.bind(showKey, item, 'visible', Gio.SettingsBindFlags.GET);
            item.connect('notify::visible', syncSeparator);
        }
        syncSeparator();

        this.connect('clicked', () => this._onClicked());
        this.menu.connect('open-state-changed', (_menu, open) => {
            // Collapsed again on close, so each opening starts collapsed.
            if (open)
                this._refresh();
            else
                this._sectionItems.forEach(item => item.menu.close(false));
        });

        // Changes made elsewhere: in Easy Effects, which also keeps the
        // toggle's subtitle and the top bar icon current with the menu
        // closed, and in the apps playing or recording.
        this._settings?.connectObject(
            ...STATE_KEYS.flatMap(key => [`changed::${key}`, () => this._refresh()]), this);
        Volume.getMixerControl().connectObject(
            'stream-added', () => this._appsChanged(),
            'stream-removed', () => this._appsChanged(), this);
        prefs.connectObject('changed::show-recording-apps', () => this._appsChanged(), this);

        this._running = false;
        this._bypassed = false;
        this._watchId = Gio.bus_watch_name(Gio.BusType.SESSION,
            EasyEffects.BUS_NAME, Gio.BusNameWatcherFlags.NONE,
            () => this._setRunning(true),
            () => this._setRunning(false));
        // Also when the Shell destroys the toggle itself, as on logout.
        this.connect('destroy', () => Gio.bus_unwatch_name(this._watchId));
    }

    get bypassed() {
        return this._bypassed;
    }

    set bypassed(bypassed) {
        if (this._bypassed === bypassed)
            return;
        this._bypassed = bypassed;
        this.notify('bypassed');
    }

    _setRunning(running) {
        this._running = running;
        this.checked = running;
        this._runningSection.actor.visible = running;
        this._refresh();
    }

    _onClicked() {
        if (!this._running) {
            EasyEffects.startService();
            return;
        }

        const app = Shell.AppSystem.get_default().lookup_app(DESKTOP_FILE);
        if (!app)
            return;
        Main.overview.hide();
        Main.panel.closeQuickSettings();
        app.activate();
    }

    async _setBypassed(bypassed) {
        // setToggleState() in _refresh() also emits 'toggled'.
        if (!this._running || bypassed === this._bypassed)
            return;
        this.bypassed = bypassed;
        await EasyEffects.setBypassed(bypassed);
        this._refresh();
    }

    async _refresh() {
        if (!this._running) {
            this.bypassed = false;
            this.subtitle = 'Not running';
            this.menu.setHeader(ICON, 'Easy Effects', 'Not running');
            return;
        }

        try {
            const [presets, active, bypassed] = await Promise.all([
                EasyEffects.getPresets(),
                EasyEffects.getActivePresets(),
                EasyEffects.isBypassed(),
            ]);
            this.bypassed = bypassed;
            this._bypassItem.setToggleState(bypassed);
            this.subtitle = (bypassed ? 'Bypassed' : active.output) || null;
            this.menu.setHeader(ICON, 'Easy Effects', bypassed ? 'Bypassed'
                : [active.output, active.input].filter(name => name).join(' · '));
            this._fillPresets(this._outputItem, presets.output, active.output);
            this._fillPresets(this._inputItem, presets.input, active.input);
            this._fillApps();
        } catch (e) {
            logError(e, 'Easy Effects Preset Changer');
        }
    }

    _fillPresets(sectionItem, names, activeName) {
        sectionItem.setStatus(activeName);
        sectionItem.menu.removeAll();
        sectionItem.setSensitive(names.length > 0);

        for (const name of names) {
            const item = new PopupMenu.PopupMenuItem(name);
            item.setOrnament(name === activeName
                ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            item.connect('activate', async () => {
                await EasyEffects.loadPreset(name);
                this._refresh();
            });
            sectionItem.menu.addMenuItem(item);
        }
    }

    // The apps list is only seen with the menu open, which refills it.
    _appsChanged() {
        if (this._running && this.menu.isOpen)
            this._fillApps();
    }

    // Lists the apps playing, and the apps recording when the preferences
    // say so, one switch each: turning it off adds the app to the Easy
    // Effects blocklist of its kind, so its sound skips the effects.
    _fillApps() {
        if (!this._outputSettings || !this._inputSettings)
            return;

        const mixer = Volume.getMixerControl();
        const groups = [['Playing', mixer.get_sink_inputs(), this._outputSettings]];
        if (this._prefs.get_boolean('show-recording-apps')) {
            const recording = mixer.get_source_outputs()
                .filter(stream => !LEVEL_METER_APPS.includes(stream.get_application_id()));
            groups.push(['Recording', recording, this._inputSettings]);
        }

        this._appsItem.menu.removeAll();
        const counts = [];
        for (const [label, streams, settings] of groups) {
            const apps = appsOf(streams);
            if (apps.size === 0)
                continue;
            counts.push(`${apps.size} ${label.toLowerCase()}`);
            if (groups.length > 1)
                this._appsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(label));

            const blocklist = settings.get_strv('blocklist');
            for (const [id, stream] of apps) {
                const name = stream.get_name();
                const blocked = blocklist.includes(id) || blocklist.includes(name);
                const item = new PopupMenu.PopupSwitchMenuItem(name, !blocked);
                item.insert_child_at_index(new St.Icon({
                    style_class: 'popup-menu-icon',
                    icon_name: stream.get_icon_name() || 'application-x-executable-symbolic',
                }), 0);
                item.connect('toggled', (_item, state) => setAppBlocked(settings, id, name, !state));
                this._appsItem.menu.addMenuItem(item);
            }
        }

        this._appsItem.setStatus(counts.join(' · ') ||
            (groups.length > 1 ? 'No apps' : 'Nothing playing'));
        this._appsItem.setSensitive(counts.length > 0);
    }
});

// The apps of some mixer streams, one stream each, by app id (or name).
function appsOf(streams) {
    const apps = new Map();
    for (const stream of streams) {
        if (stream.is_event_stream)
            continue;
        const name = stream.get_name();
        const id = stream.get_application_id() || name;
        if (name && !apps.has(id))
            apps.set(id, stream);
    }
    return apps;
}

function setAppBlocked(settings, id, name, blocked) {
    const blocklist = settings.get_strv('blocklist')
        .filter(entry => entry !== id && entry !== name);
    if (blocked)
        blocklist.push(id);
    settings.set_strv('blocklist', blocklist);
}

// Adds the toggle to Quick Settings, and an icon to the top bar shown
// while the global bypass is on.
export const PresetIndicator = GObject.registerClass(
class PresetIndicator extends SystemIndicator {
    _init(prefs) {
        super._init();

        const toggle = new PresetToggle(prefs);
        this.quickSettingsItems.push(toggle);

        this._bypassIcon = this._addIndicator();
        this._bypassIcon.gicon = ICON;
        toggle.bind_property('bypassed', this._bypassIcon, 'visible',
            GObject.BindingFlags.SYNC_CREATE);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
