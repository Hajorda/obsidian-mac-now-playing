import { Plugin, setIcon } from 'obsidian';
import { exec } from 'child_process';
import { MacNowPlayingSettings, DEFAULT_SETTINGS, MacNowPlayingSettingTab } from './settings';

export default class MacNowPlayingPlugin extends Plugin {
	settings!: MacNowPlayingSettings;
	statusBarItemEl!: HTMLElement;
	popoverEl!: HTMLElement;
	isOpen: boolean = false;
	intervalId: number | null = null;
	
	currentTrack = {
		name: '',
		artist: '',
		album: '',
		state: '',
		artworkUrl: '',
		durationMs: 0,
		positionSec: 0
	};

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MacNowPlayingSettingTab(this.app, this));

		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.setText('');
		this.statusBarItemEl.addClass('spotify-status-bar');

		this.createPopover();

		this.statusBarItemEl.addEventListener('click', (e) => {
			e.stopPropagation();
			this.togglePopover();
		});

		this.registerDomEvent(activeDocument, 'click', (e) => {
			if (this.isOpen && !this.popoverEl.contains(e.target as Node)) {
				this.closePopover();
			}
		});

		this.updateNowPlaying();
		this.applyInterval();
	}

	onunload() {
		if (this.popoverEl) this.popoverEl.remove();
		if (this.intervalId) window.clearInterval(this.intervalId);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<MacNowPlayingSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	applyInterval() {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
		}
		this.intervalId = window.setInterval(() => {
			this.updateNowPlaying();
		}, this.settings.refreshInterval * 1000);
		this.registerInterval(this.intervalId);
	}

	createPopover() {
		this.popoverEl = activeDocument.body.createDiv('spotify-popover');
		
		const header = this.popoverEl.createDiv('spotify-popover-header');
		header.setText('Now Playing');

		const mainContent = this.popoverEl.createDiv('spotify-popover-main');
		
		// Album Art
		const artContainer = mainContent.createDiv('spotify-art-container');
		artContainer.createEl('img', { cls: 'spotify-art-img' });

		// Track Info
		const infoContainer = mainContent.createDiv('spotify-track-info');
		
		const nameContainer = infoContainer.createDiv('spotify-track-name spotify-marquee-container');
		nameContainer.createSpan('spotify-marquee-content');
		
		const artistContainer = infoContainer.createDiv('spotify-track-artist spotify-marquee-container');
		artistContainer.createSpan('spotify-marquee-content');
		
		const albumContainer = infoContainer.createDiv('spotify-track-album spotify-marquee-container');
		albumContainer.createSpan('spotify-marquee-content');

		// Progress Bar
		const progressContainer = this.popoverEl.createDiv('spotify-progress-container');
		const progressTimes = progressContainer.createDiv('spotify-progress-times');
		progressTimes.createSpan('spotify-time-current');
		progressTimes.createSpan('spotify-time-total');
		
		const progressBar = progressContainer.createDiv('spotify-progress-bar');
		progressBar.createDiv('spotify-progress-fill');

		// Controls
		const controls = this.popoverEl.createDiv('spotify-controls');
		
		const prevBtn = controls.createEl('button', { cls: 'spotify-control-btn' });
		setIcon(prevBtn, 'skip-back');
		prevBtn.addEventListener('click', () => this.runMediaCommand('previous track'));

		const playBtn = controls.createEl('button', { cls: 'spotify-control-btn spotify-play-btn' });
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', () => this.runMediaCommand('playpause'));

		const nextBtn = controls.createEl('button', { cls: 'spotify-control-btn' });
		setIcon(nextBtn, 'skip-forward');
		nextBtn.addEventListener('click', () => this.runMediaCommand('next track'));
	}

	togglePopover() {
		if (this.isOpen) {
			this.closePopover();
		} else {
			this.openPopover();
		}
	}

	openPopover() {
		if (!this.currentTrack.name) return;

		this.isOpen = true;
		this.popoverEl.addClass('is-open');
		
		const rect = this.statusBarItemEl.getBoundingClientRect();
		// We make the popover a bit wider if artwork is shown
		const popoverWidth = this.settings.showAlbumArt ? 240 : 180;
		const padding = 10;
		
		this.popoverEl.setCssProps({
			"width": `${popoverWidth}px`,
			"left": `${rect.right - popoverWidth}px`,
			"bottom": `${window.innerHeight - rect.top + padding}px`
		});
		
		this.renderPopoverContent();
	}

	closePopover() {
		this.isOpen = false;
		this.popoverEl.removeClass('is-open');
	}

	formatTime(totalSeconds: number): string {
		if (isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
		const m = Math.floor(totalSeconds / 60);
		const s = Math.floor(totalSeconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	renderPopoverContent() {
		if (!this.popoverEl) return;
		
		const nameContainer = this.popoverEl.querySelector('.spotify-track-name');
		const nameEl = nameContainer?.querySelector('.spotify-marquee-content');
		const artistContainer = this.popoverEl.querySelector('.spotify-track-artist');
		const artistEl = artistContainer?.querySelector('.spotify-marquee-content');
		const albumContainer = this.popoverEl.querySelector('.spotify-track-album');
		const albumEl = albumContainer?.querySelector('.spotify-marquee-content');
		
		const playBtn = this.popoverEl.querySelector('.spotify-play-btn');
		
		const artContainer = this.popoverEl.querySelector('.spotify-art-container') as HTMLElement;
		const artImg = this.popoverEl.querySelector('.spotify-art-img') as HTMLImageElement;
		
		const progressContainer = this.popoverEl.querySelector('.spotify-progress-container') as HTMLElement;
		const timeCurrentEl = this.popoverEl.querySelector('.spotify-time-current');
		const timeTotalEl = this.popoverEl.querySelector('.spotify-time-total');
		const progressFill = this.popoverEl.querySelector('.spotify-progress-fill') as HTMLElement;

		if (nameEl) nameEl.textContent = this.currentTrack.name;
		if (artistEl) artistEl.textContent = this.currentTrack.artist;
		if (albumEl) albumEl.textContent = this.currentTrack.album;

		window.requestAnimationFrame(() => {
			this.applyMarquee(nameContainer, nameEl);
			this.applyMarquee(artistContainer, artistEl);
			this.applyMarquee(albumContainer, albumEl);
		});

		// Album Art Toggle
		if (this.settings.showAlbumArt && this.currentTrack.artworkUrl) {
			artContainer.show();
			if (artImg.src !== this.currentTrack.artworkUrl) {
				artImg.src = this.currentTrack.artworkUrl;
			}
		} else {
			artContainer.hide();
		}

		// Progress Bar Toggle
		if (this.settings.showProgressBar && this.currentTrack.durationMs > 0) {
			progressContainer.setCssProps({ "display": "flex" });
			
			const totalSecs = Math.floor(this.currentTrack.durationMs / 1000);
			const currentSecs = Math.floor(this.currentTrack.positionSec);
			
			if (timeCurrentEl) timeCurrentEl.textContent = this.formatTime(currentSecs);
			if (timeTotalEl) timeTotalEl.textContent = this.formatTime(totalSecs);
			
			let pct = (currentSecs / totalSecs) * 100;
			if (pct > 100) pct = 100;
			if (pct < 0) pct = 0;
			
			if (progressFill) progressFill.setCssProps({ "width": `${pct}%` });
		} else {
			progressContainer.hide();
		}

		if (playBtn) {
			playBtn.empty();
			setIcon(playBtn as HTMLElement, this.currentTrack.state === 'playing' ? 'pause' : 'play');
		}
	}

	applyMarquee(container: Element | null | undefined, content: Element | null | undefined) {
		if (!container || !content) return;
		
		if (this.settings.useSlidingText) {
			const cWidth = container.clientWidth;
			const sWidth = content.scrollWidth;
			
			if (sWidth > cWidth && cWidth > 0) {
				const dist = `-${sWidth - cWidth}px`;
				const el = content as HTMLElement;
				// Only update if it changed to prevent resetting the animation loop
				if (el.style.getPropertyValue('--slide-dist') !== dist || !content.hasClass('is-sliding')) {
					content.addClass('is-sliding');
					el.setCssProps({ "--slide-dist": dist });
				}
			} else {
				content.removeClass('is-sliding');
				(content as HTMLElement).style.removeProperty('--slide-dist');
			}
		} else {
			content.removeClass('is-sliding');
			(content as HTMLElement).style.removeProperty('--slide-dist');
		}
	}

	runMediaCommand(command: string) {
		const appName = this.settings.mediaPlayer === 'Music' ? 'Music' : 'Spotify';
		const script = `osascript -e 'tell application "${appName}" to ${command}'`;
		exec(script, (error) => {
			if (!error) {
				window.setTimeout(() => this.updateNowPlaying(), 300);
			}
		});
	}

	truncateStr(str: string, maxLen: number) {
		if (maxLen > 0 && str.length > maxLen) {
			return str.substring(0, maxLen) + '...';
		}
		return str;
	}

	renderStatusBar() {
		if (!this.currentTrack.name || (this.settings.hideWhenPaused && this.currentTrack.state !== 'playing')) {
			this.statusBarItemEl.hide();
			if (this.isOpen) this.closePopover();
			return;
		}

		this.statusBarItemEl.setCssProps({ "display": "flex" });
		this.statusBarItemEl.empty();

		if (this.settings.iconStyle !== 'none') {
			const iconEl = this.statusBarItemEl.createDiv('spotify-icon-container');
			if (this.currentTrack.state === 'playing') {
				iconEl.addClass('is-playing');
			}
			
			if (this.settings.iconStyle === 'eq') {
				iconEl.addClass('icon-eq');
				iconEl.createDiv('spotify-bar bar1');
				iconEl.createDiv('spotify-bar bar2');
				iconEl.createDiv('spotify-bar bar3');
			} else if (this.settings.iconStyle === 'vinyl') {
				iconEl.addClass('icon-vinyl');
				iconEl.setText('💿');
			} else if (this.settings.iconStyle === 'emoji') {
				iconEl.addClass('icon-emoji');
				iconEl.setText('🎵');
			}
		}

		const textEl = this.statusBarItemEl.createSpan('spotify-status-text');
		let displayStr = this.settings.displayFormat;
		
		const safeTitle = this.truncateStr(this.currentTrack.name, this.settings.maxTitleLength);
		
		displayStr = displayStr.replace('{{title}}', safeTitle);
		displayStr = displayStr.replace('{{artist}}', this.currentTrack.artist);
		displayStr = displayStr.replace('{{album}}', this.currentTrack.album);

		textEl.setText(` ${displayStr}`);
		
		if (this.settings.statusBarPosition === 'left') {
			this.statusBarItemEl.addClass('spotify-align-left');
		} else {
			this.statusBarItemEl.removeClass('spotify-align-left');
		}
	}

	updateNowPlaying() {
		const appName = this.settings.mediaPlayer === 'Music' ? 'Music' : 'Spotify';
		
		const script = `osascript -e 'tell application "System Events"
			if exists process "${appName}" then
				tell application "${appName}"
					if player state is playing or player state is paused then
						set tName to name of current track
						set tArtist to artist of current track
						set tAlbum to album of current track
						set tState to player state as string
						
						set tDur to "0"
						try
							set tDur to duration of current track as string
						end try
						
						set tPos to "0"
						try
							set tPos to player position as string
						end try

						set tArt to ""
						if "${appName}" is "Spotify" then
							try
								set tArt to artwork url of current track
							end try
						end if

						return tName & "|||" & tArtist & "|||" & tAlbum & "|||" & tState & "|||" & tArt & "|||" & tDur & "|||" & tPos
					else
						return ""
					end if
				end tell
			else
				return ""
			end if
		end tell'`;

		exec(script, (error, stdout) => {
			if (error || !stdout.trim()) {
				this.currentTrack = { name: '', artist: '', album: '', state: '', artworkUrl: '', durationMs: 0, positionSec: 0 };
				this.renderStatusBar();
				return;
			}
			
			const parts = stdout.trim().split('|||');
			if (parts.length >= 7) {
				const durationRaw = parseFloat(parts[5] || '0') || 0;
				// Apple Music returns duration in seconds, Spotify usually in ms. We handle this dynamically by checking if it's huge.
				// If duration is > 5000 it's likely ms. If less, it's seconds.
				const isMs = durationRaw > 5000;
				const durationMs = isMs ? durationRaw : durationRaw * 1000;

				this.currentTrack = {
					name: parts[0] || '',
					artist: parts[1] || '',
					album: parts[2] || '',
					state: parts[3] || '',
					artworkUrl: parts[4] || '',
					durationMs: durationMs,
					positionSec: parseFloat(parts[6] || '0') || 0
				};
				
				this.renderStatusBar();

				if (this.isOpen) {
					this.renderPopoverContent();
				}
			}
		});
	}
}
