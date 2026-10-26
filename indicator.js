// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as EasyEffects from './easyeffects.js';

const ICON_NAME = 'audio-speakers-symbolic';

// The Quick Settings toggle. Clicking it turns the global bypass on or
// off; its menu lists the presets and loads the one picked.
const PresetToggle = GObject.registerClass(
class PresetToggle extends QuickMenuToggle {
    _init() {
        super._init({
            title: 'Easy Effects',
            iconName: ICON_NAME,
        });

        this.menu.setHeader(ICON_NAME, 'Easy Effects');

        this._outputSection = new PopupMenu.PopupMenuSection();
        this._inputSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._outputSection);
        this.menu.addMenuItem(this._inputSection);

        this._startItem = new PopupMenu.PopupMenuItem('Start Easy Effects');
        this._startItem.connect('activate', () => EasyEffects.startService());
        this.menu.addMenuItem(this._startItem);

        this.connect('clicked', () => this._toggleBypass());
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
        });

        this._running = false;
        this._watchId = Gio.bus_watch_name(Gio.BusType.SESSION,
            EasyEffects.BUS_NAME, Gio.BusNameWatcherFlags.NONE,
            () => this._setRunning(true),
            () => this._setRunning(false));
    }

    _setRunning(running) {
        this._running = running;
        this._startItem.visible = !running;
        this._refresh();
    }

    async _toggleBypass() {
        if (!this._running)
            return;
        await EasyEffects.setBypassed(this.checked);
        this._refresh();
    }

    async _refresh() {
        if (!this._running) {
            this.checked = false;
            this.subtitle = 'Not running';
            this.menu.setHeader(ICON_NAME, 'Easy Effects', 'Not running');
            this._outputSection.removeAll();
            this._inputSection.removeAll();
            return;
        }

        try {
            const [presets, active, bypassed] = await Promise.all([
                EasyEffects.getPresets(),
                EasyEffects.getActivePresets(),
                EasyEffects.isBypassed(),
            ]);
            this.checked = !bypassed;
            this.subtitle = active.output || null;
            this.menu.setHeader(ICON_NAME, 'Easy Effects',
                bypassed ? 'Bypassed' : active.output);
            this._fillSection(this._outputSection, 'Output',
                presets.output, active.output);
            this._fillSection(this._inputSection, 'Input',
                presets.input, active.input);
        } catch (e) {
            logError(e, 'Easy Effects Preset Changer');
        }
    }

    _fillSection(section, label, names, activeName) {
        section.removeAll();
        if (names.length === 0)
            return;

        section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(label));
        for (const name of names) {
            const item = new PopupMenu.PopupMenuItem(name);
            item.setOrnament(name === activeName
                ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            item.connect('activate', async () => {
                await EasyEffects.loadPreset(name);
                this._refresh();
            });
            section.addMenuItem(item);
        }
    }

    destroy() {
        Gio.bus_unwatch_name(this._watchId);
        super.destroy();
    }
});

export const PresetIndicator = GObject.registerClass(
class PresetIndicator extends SystemIndicator {
    _init() {
        super._init();
        this.quickSettingsItems.push(new PresetToggle());
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
