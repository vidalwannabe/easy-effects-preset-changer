// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// The options the Quick Settings menu can show: [setting, title].
const SHOWN_OPTIONS = [
    ['show-apps', 'Apps'],
    ['show-bypass', 'Bypass'],
    ['show-process-all-outputs', 'Process all outputs'],
    ['show-process-all-inputs', 'Process all inputs'],
    ['show-pause-when-silent', 'Pause when silent'],
];

// One page: a switch per menu option, on when the menu shows it.
export default class PresetChangerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(600, 420);
        window.set_size_request(600, -1);
        window.set_search_enabled(false);

        const settings = this.getSettings();
        const group = new Adw.PreferencesGroup({
            title: 'Quick Settings options',
            description: 'Choose which options are shown in the Easy Effects Quick Settings menu',
        });
        for (const [key, title] of SHOWN_OPTIONS) {
            const row = new Adw.SwitchRow({title});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }

        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
    }
}
