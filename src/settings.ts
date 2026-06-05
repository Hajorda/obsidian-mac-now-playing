import { App, PluginSettingTab, Setting } from 'obsidian';
import MacNowPlayingPlugin from './main';

export interface MacNowPlayingSettings {
	mediaPlayer: 'Spotify' | 'Music';
	refreshInterval: number;
	hideWhenPaused: boolean;
	displayFormat: string;
	maxTitleLength: number;
	iconStyle: 'eq' | 'vinyl' | 'emoji' | 'none';
	showAlbumArt: boolean;
	showProgressBar: boolean;
	useSlidingText: boolean;
}

export const DEFAULT_SETTINGS: MacNowPlayingSettings = {
	mediaPlayer: 'Spotify',
	refreshInterval: 5,
	hideWhenPaused: false,
	displayFormat: '{{title}} - {{artist}}',
	maxTitleLength: 30,
	iconStyle: 'vinyl',
	showAlbumArt: true,
	showProgressBar: true,
	useSlidingText: true
}

export class MacNowPlayingSettingTab extends PluginSettingTab {
	plugin: MacNowPlayingPlugin;

	constructor(app: App, plugin: MacNowPlayingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Media Player')
			.setDesc('Choose which app to fetch the current track from.')
			.addDropdown(drop => drop
				.addOption('Spotify', 'Spotify')
				.addOption('Music', 'Apple Music')
				.setValue(this.plugin.settings.mediaPlayer)
				.onChange(async (value) => {
					this.plugin.settings.mediaPlayer = value as 'Spotify' | 'Music';
					await this.plugin.saveSettings();
					this.plugin.updateNowPlaying();
				}));

		new Setting(containerEl)
			.setName('Refresh Interval (seconds)')
			.setDesc('How often to check for track updates.')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.plugin.settings.refreshInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.refreshInterval = value;
					await this.plugin.saveSettings();
					this.plugin.applyInterval();
				}));

		new Setting(containerEl)
			.setName('Hide When Paused')
			.setDesc('Completely hide the status bar item if no music is playing.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideWhenPaused)
				.onChange(async (value) => {
					this.plugin.settings.hideWhenPaused = value;
					await this.plugin.saveSettings();
					this.plugin.renderStatusBar();
				}));

		new Setting(containerEl)
			.setName('Display Format')
			.setDesc('Variables: {{title}}, {{artist}}, {{album}}')
			.addText(text => text
				.setValue(this.plugin.settings.displayFormat)
				.onChange(async (value) => {
					this.plugin.settings.displayFormat = value;
					await this.plugin.saveSettings();
					this.plugin.renderStatusBar();
				}));

		new Setting(containerEl)
			.setName('Max Title Size')
			.setDesc('Truncate the {{title}} after this many characters (0 for unlimited).')
			.addText(text => text
				.setValue(this.plugin.settings.maxTitleLength.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed)) {
						this.plugin.settings.maxTitleLength = parsed;
						await this.plugin.saveSettings();
						this.plugin.renderStatusBar();
					}
				}));

		new Setting(containerEl)
			.setName('Icon Style')
			.setDesc('Choose the animated icon shown in the status bar.')
			.addDropdown(drop => drop
				.addOption('eq', 'Animated EQ Bars')
				.addOption('vinyl', 'Spinning Vinyl')
				.addOption('emoji', 'Static Emoji (🎵)')
				.addOption('none', 'None')
				.setValue(this.plugin.settings.iconStyle)
				.onChange(async (value) => {
					this.plugin.settings.iconStyle = value as 'eq' | 'vinyl' | 'emoji' | 'none';
					await this.plugin.saveSettings();
					this.plugin.renderStatusBar();
				}));

		new Setting(containerEl)
			.setName('Show Album Art')
			.setDesc('Display the album cover in the popover window (Spotify only).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showAlbumArt)
				.onChange(async (value) => {
					this.plugin.settings.showAlbumArt = value;
					await this.plugin.saveSettings();
					this.plugin.renderPopoverContent();
				}));

		new Setting(containerEl)
			.setName('Show Progress Bar')
			.setDesc('Display a live track progress bar in the popover window.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showProgressBar)
				.onChange(async (value) => {
					this.plugin.settings.showProgressBar = value;
					await this.plugin.saveSettings();
					this.plugin.renderPopoverContent();
				}));

		new Setting(containerEl)
			.setName('Use Sliding Text')
			.setDesc('Smoothly scroll long text that does not fit inside the popover instead of cutting it off.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSlidingText)
				.onChange(async (value) => {
					this.plugin.settings.useSlidingText = value;
					await this.plugin.saveSettings();
					this.plugin.renderPopoverContent();
				}));
	}
}
