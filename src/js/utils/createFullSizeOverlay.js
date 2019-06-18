import { getImageSize } from './getImageSize';

/**
 * Register the full size overlay so that it will be instantiated upon clicking the image preview wrapper
 */
export const registerFullSizeOverlay = (item, imageCanvas) => {
    let wrapper = imageCanvas.closest('.filepond--image-preview-wrapper');
    wrapper.style.cursor = 'zoom-in';
    wrapper.addEventListener("click", () => {
        createFullSizeOverlay(item, imageCanvas);
    });
}

/**
 * Generate the full size overlay and present the image in it.
 */
export const createFullSizeOverlay = (item, imageCanvas) => {
    let imageUrl = imageCanvas.toDataURL();

    const overlay = document.createElement('div');
    overlay.className = 'filepond--fullsize-overlay';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    imgContainer.style.backgroundImage = 'url(' + imageUrl + ')';

    determineImageOverlaySize(item, imageCanvas, imgContainer);

    let body = document.getElementsByTagName("body")[0];
    overlay.appendChild(imgContainer);
    body.appendChild(overlay);

    overlay.addEventListener("click", () => {
        overlay.remove();
    });
}

/**
 * Determines whether the image is larger than the viewport.
 * If so, set the backgroundSize to 'contain' to scale down the image so it fits the overlay.
 */
export const determineImageOverlaySize = (item, imgCanvas, imgContainer) => {
    const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
          h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
          fileURL = URL.createObjectURL(item.file);

    getImageSize(fileURL, (width, height) => {
        if (width > w || height > h) {
            imgContainer.style.backgroundSize = 'contain';
        }
    });
}