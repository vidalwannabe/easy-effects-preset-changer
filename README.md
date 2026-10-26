# Easy Effects Preset Changer

GNOME Shell extension that adds an **Easy Effects** toggle to Quick Settings:

- Click the toggle to turn the global bypass on or off.
- Open its menu to see your output and input presets and load one; the loaded one is checked.
- If Easy Effects is not running, the menu offers to start it in the background.
- **Easy Effects Settings**, at the bottom of the menu, opens the Easy Effects window.

It talks to Easy Effects through its command line client (`easyeffects -p`, `-a`, `-l`, `-b`), so it only needs Easy Effects 7 installed natively.

## Install from source

```bash
git clone https://github.com/vidalwannabe/easy-effects-preset-changer.git \
  ~/.local/share/gnome-shell/extensions/easy-effects-preset-changer@vidalwannabe.github.io
```

Log out and back in, then enable it in Extensions or with:

```bash
gnome-extensions enable easy-effects-preset-changer@vidalwannabe.github.io
```

Supports GNOME Shell 48.

## Credits

`icons/easyeffects-symbolic.svg` is the symbolic icon of [Easy Effects](https://github.com/wwmm/easyeffects), by Wellington Wallace and contributors, licensed under GPL-3.0-or-later.
