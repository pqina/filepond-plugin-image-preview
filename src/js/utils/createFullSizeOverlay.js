/**
 * Register the full size overlay so that it will be instantiated upon clicking the image preview wrapper
 * @param imageCanvas
 */
export const registerFullSizeOverlay = (imageCanvas) => {
    let wrapper = imageCanvas.closest('.filepond--image-preview-wrapper');
    wrapper.style.cursor = 'zoom-in';
    wrapper.addEventListener("click", () => {
        createFullSizeOverlay(imageCanvas);
    });
}

/**
 * Generate the full size overlay and present the image in it.
 * @param imageCanvas the preview canvas to read the image data url from
 */
export const createFullSizeOverlay = (imageCanvas) => {
    let imageUrl = imageCanvas.toDataURL();

    const overlay = document.createElement('div');
    overlay.className = 'filepond--fullsize-overlay';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    imgContainer.style.backgroundImage = 'url(' + imageUrl + ')';

    let body = document.getElementsByTagName("body")[0];
    overlay.appendChild(imgContainer);
    body.appendChild(overlay);
    overlay.classList.add('visible');

    overlay.addEventListener("click", () => {
        overlay.remove();
    });
}