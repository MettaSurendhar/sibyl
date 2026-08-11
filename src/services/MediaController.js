class MediaControllerSingleton {
	constructor() {
		this.activeHandler = null;
	}

	// Register an active handler (usually the mounted screen)
	// Example handler: { onPlay: () => {}, onPause: () => {}, onFwd: () => {}, onBwd: () => {}, onSave: () => {} }
	register(handler) {
		this.activeHandler = handler;
	}

	unregister(handler) {
		if (this.activeHandler === handler) {
			this.activeHandler = null;
		}
	}

	onAction(action) {
		if (!this.activeHandler) return;
		switch (action) {
			case 'play':
				this.activeHandler.onPlay?.();
				break;
			case 'pause':
				this.activeHandler.onPause?.();
				break;
			case 'fwd':
				this.activeHandler.onFwd?.();
				break;
			case 'bwd':
				this.activeHandler.onBwd?.();
				break;
			case 'save':
				this.activeHandler.onSave?.();
				break;
		}
	}
}

export const MediaController = new MediaControllerSingleton();
