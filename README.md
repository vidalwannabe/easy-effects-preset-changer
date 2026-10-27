# Easy Effects Preset Changer

GNOME Shell extension that adds an **Easy Effects** toggle to Quick Settings:

- The toggle is on while Easy Effects is running. Click it to start Easy Effects in the background, or, when it is already running, to open its window.
- Its menu has three collapsible lists, all collapsed whenever the menu opens:
  - **Output** and **Input** list your presets, with the loaded one checked and shown next to the list name. Pick one to load it.
  - **Apps** lists the apps playing sound, each with a switch: turn it off to add the app to the Easy Effects blocklist, so its sound skips the effects.
- Below them, switches for the global **Bypass**, **Process all outputs**, **Process all inputs** and **Pause when silent** (the Easy Effects inactivity timer).
- **Quit Easy Effects**, at the bottom, stops Easy Effects.
- The preferences choose which of the four switches the menu shows.

It talks to Easy Effects through its command line client (`easyeffects -p`, `-a`, `-l`, `-b`, `-q`) and its settings, so it only needs Easy Effects 7 installed natively.

## Install from source

```bash
git clone https://github.com/vidalwannabe/easy-effects-preset-changer.git \
  ~/.local/share/gnome-shell/extensions/easy-effects-preset-changer@vidalwannabe.github.io
glib-compile-schemas \
  ~/.local/share/gnome-shell/extensions/easy-effects-preset-changer@vidalwannabe.github.io/schemas
```

Log out and back in, then enable it in Extensions or with:

```bash
gnome-extensions enable easy-effects-preset-changer@vidalwannabe.github.io
```

Supports GNOME Shell 48.

## Credits

`icons/easyeffects-symbolic.svg` is the symbolic icon of [Easy Effects](https://github.com/wwmm/easyeffects), by Wellington Wallace and contributors, licensed under GPL-3.0-or-later.
