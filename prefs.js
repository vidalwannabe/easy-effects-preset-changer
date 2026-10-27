// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// The switches the Quick Settings menu can show, below Apps: [setting, title].
const SHOWN_SWITCHES = [
    ['show-bypass', 'Bypass'],
    ['show-process-all-outputs', 'Process all outputs'],
    ['show-process-all-inputs', 'Process all inputs'],
    ['show-pause-when-silent', 'Pause when silent'],
];

// One page: a switch per menu option, on when the menu shows it. Apps is
// a row that expands to its own option.
export default class PresetChangerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(600, 422);
        window.set_size_request(600, -1);
        window.set_search_enabled(false);

        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const shown = new Adw.PreferencesGroup({
            title: 'Quick Settings options',
            description: 'Choose which options are shown in the Easy Effects Quick Settings menu',
        });
        // Its switch shows Apps; turned off, it also disables what it holds.
        const apps = new Adw.ExpanderRow({title: 'Apps', show_enable_switch: true});
        settings.bind('show-apps', apps, 'enable-expansion', Gio.SettingsBindFlags.DEFAULT);
        apps.add_row(this._switchRow(settings, 'show-recording-apps', 'Recording apps'));
        shown.add(apps);
        for (const [key, title] of SHOWN_SWITCHES)
            shown.add(this._switchRow(settings, key, title));
        page.add(shown);

        window.add(page);
    }

    _switchRow(settings, key, title) {
        const row = new Adw.SwitchRow({title});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}
