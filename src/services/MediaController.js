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
		// If called with no argument, clear unconditionally (cleanup on unmount).
		// If called with a handler, only clear if it's still the active one.
		if (handler === undefined || this.activeHandler === handler) {
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
			case 'discard':
				this.activeHandler.onDiscard?.();
				break;
			case 'cancel':
				this.activeHandler.onCancel?.();
				break;
		}
	}
}

export const MediaController = new MediaControllerSingleton();
