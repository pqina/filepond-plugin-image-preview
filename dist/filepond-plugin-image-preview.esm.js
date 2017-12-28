/*
 * FilePondPluginImagePreview 1.0.1
 * Licensed under MIT, https://opensource.org/licenses/MIT
 * Please visit https://pqina.nl/filepond for details.
 */
// test if file is of type image and can be viewed in canvas
const isPreviewableImage = file =>
  /^image/.test(file.type) && !/svg/.test(file.type);

const transforms = {
  1: () => [1, 0, 0, 1, 0, 0],
  2: width => [-1, 0, 0, 1, width, 0],
  3: (width, height) => [-1, 0, 0, -1, width, height],
  4: (width, height) => [1, 0, 0, -1, 0, height],
  5: [0, 1, 1, 0, 0, 0],
  6: (width, height) => [0, 1, -1, 0, height, 0],
  7: (width, height) => [0, -1, -1, 0, height, width],
  8: width => [0, -1, 1, 0, 0, width]
};

const fixImageOrientation = (ctx, width, height, orientation) => {
  // no orientation supplied
  if (orientation === -1) {
    return;
  }

  ctx.transform(...transforms[orientation](width, height));
};

// draws the preview image
const createPreviewImage = (data, width, height, orientation) => {
  // width and height have already been swapped earlier if orientation was in range below, let's swap back to make this code a bit more readable
  if (orientation >= 5 && orientation <= 8) {
    [width, height] = [height, width];
  }

  // draw image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // if is rotated incorrectly swap width and height
  if (orientation >= 5 && orientation <= 8) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  // correct image orientation
  ctx.save();
  fixImageOrientation(ctx, width, height, orientation);

  // draw the image
  ctx.drawImage(data, 0, 0, width, height);
  // end draw image
  ctx.restore();

  // data has been transferred to canvas
  if (data.close) {
    data.close();
  }

  return canvas;
};

const createImagePresenterView = fpAPI =>
  fpAPI.utils.createView({
    name: 'image-preview',
    tag: 'canvas',
    create: ({ root, props }) => {
      root.element.width = 0;
      root.element.height = 0;
    },
    write: fpAPI.utils.createRoute({
      DID_LOAD_PREVIEW_IMAGE: ({ root, props, action }) => {
        // set new root dimensions
        root.element.width = action.width;
        root.element.height = action.height;

        // draw preview to root
        const ctx = root.element.getContext('2d');
        ctx.drawImage(
          createPreviewImage(
            action.data,
            root.element.width,
            root.element.height,
            action.orientation
          ),
          0,
          0
        );

        // let others know of our fabulous achievement, we'll delay it a bit so the back panel can finish stretching
        setTimeout(() => {
          root.dispatch('DID_DRAW_PREVIEW_IMAGE', { id: props.id });
        }, 250);
      }
    }),
    mixins: {
      styles: ['scaleX', 'scaleY', 'opacity'],
      animations: {
        scaleX: {
          type: 'spring',
          stiffness: 0.5,
          damping: 0.45,
          mass: 10
        },
        scaleY: {
          type: 'spring',
          stiffness: 0.5,
          damping: 0.45,
          mass: 10
        },
        opacity: { type: 'tween', duration: 750 }
      }
    }
  });

const overlayTemplate = document.createElement('canvas');
const overlayTemplateError = document.createElement('canvas');
const overlayTemplateSuccess = document.createElement('canvas');

const drawTemplate = (canvas, colorFrom, colorTo) => {
  const width = 500;
  const height = 200;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const horizontalCenter = width * 0.5;

  const grad = ctx.createRadialGradient(
    horizontalCenter,
    height + 110,
    height - 100,
    horizontalCenter,
    height + 110,
    height + 100
  );
  grad.addColorStop(0.5, 'rgba(' + colorFrom.join(',') + ')');
  grad.addColorStop(1, 'rgba(' + colorTo.join(',') + ')');

  ctx.save();
  ctx.translate(-width * 0.25, 0);
  ctx.scale(1.5, 1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const applyTemplate = (source, target) => {
  // copy width and height
  target.width = source.width;
  target.height = source.height;

  // draw the template
  const ctx = target.getContext('2d');
  ctx.drawImage(source, 0, 0);
};

drawTemplate(overlayTemplate, [40, 40, 40, 0], [40, 40, 40, 0.85]);
drawTemplate(overlayTemplateError, [196, 78, 71, 0], [196, 78, 71, 1]);
drawTemplate(overlayTemplateSuccess, [54, 151, 99, 0], [54, 151, 99, 1]);

const createImageOverlayView = fpAPI =>
  fpAPI.utils.createView({
    name: 'image-overlay',
    tag: 'div',
    create: ({ root, props }) => {
      // default shadow overlay
      root.ref.overlayShadow = document.createElement('canvas');
      root.appendChild(root.ref.overlayShadow);
      applyTemplate(overlayTemplate, root.ref.overlayShadow);

      // error state overlay
      root.ref.overlayError = document.createElement('canvas');
      root.appendChild(root.ref.overlayError);
      applyTemplate(overlayTemplateError, root.ref.overlayError);

      // success state overlay
      root.ref.overlaySuccess = document.createElement('canvas');
      root.appendChild(root.ref.overlaySuccess);
      applyTemplate(overlayTemplateSuccess, root.ref.overlaySuccess);
    },
    mixins: {
      styles: ['opacity'],
      animations: {
        opacity: { type: 'tween', duration: 500 }
      }
    }
  });

const getImageSize = (url, cb) => {
  const image = new Image();
  image.onload = () => {
    cb(image.naturalWidth, image.naturalHeight);
  };
  image.src = url;
};

const fitToBounds = (width, height, boundsWidth, boundsHeight) => {
  const resizeFactor = Math.min(boundsWidth / width, boundsHeight / height);
  return {
    width: Math.round(width * resizeFactor),
    height: Math.round(height * resizeFactor)
  };
};

const getImageScaledSize = (file, boundsWidth, boundsHeight, cb) => {
  getImageSize(file, (naturalWidth, naturalHeight) => {
    const size = fitToBounds(
      naturalWidth,
      naturalHeight,
      boundsWidth,
      boundsHeight
    );
    cb(size.width, size.height);
  });
};

/**
 * Bitmap Worker
 */
const BitmapWorker = function() {
  // route messages
  self.onmessage = e => {
    toBitmap(e.data.message, response => {
      self.postMessage({ id: e.data.id, message: response });
    });
  };

  // resize image data
  const toBitmap = (options, cb) => {
    const { file, resizeWidth, resizeHeight } = options;

    /*
        const imageBitmapSettings = {
            resizeWidth,
            resizeHeight,
            resizeQuality: 'medium'
        }
        */

    // FileReader is required for Firefox, otherwise it throws an invalid state error on createImageBitmap
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([new Uint8Array(reader.result)], {
        type: file.type
      });

      // we don't pass the imageBitmapSettings object, at the time of this writing it is still behind flags so it does nothing
      createImageBitmap(blob)
        .catch(error => {
          cb(null);
        })
        .then(imageBitmap => {
          cb(imageBitmap);
        });
    };
    reader.readAsArrayBuffer(file);
  };
};

const Marker = {
  JPEG: 0xffd8,
  APP1: 0xffe1,
  EXIF: 0x45786966,
  TIFF: 0x4949,
  Orientation: 0x0112,
  Unknown: 0xff00
};

const getUint16 = (view, offset, little = false) =>
  view.getUint16(offset, little);
const getUint32 = (view, offset, little = false) =>
  view.getUint32(offset, little);

const getImageOrientation = (file, cb) => {
  const reader = new FileReader();
  reader.onload = function(e) {
    const view = new DataView(e.target.result);

    // Every JPEG file starts from binary value '0xFFD8'
    if (getUint16(view, 0) !== Marker.JPEG) {
      // This aint no JPEG
      cb(-1);
      return;
    }

    const length = view.byteLength;
    let offset = 2;

    while (offset < length) {
      const marker = getUint16(view, offset);
      offset += 2;

      // There's or APP1 Marker
      if (marker === Marker.APP1) {
        if (getUint32(view, (offset += 2)) !== Marker.EXIF) {
          // no EXIF info defined
          break;
        }

        // Get TIFF Header
        const little = getUint16(view, (offset += 6)) === Marker.TIFF;
        offset += getUint32(view, offset + 4, little);

        const tags = getUint16(view, offset, little);
        offset += 2;

        for (let i = 0; i < tags; i++) {
          // found the orientation tag
          if (getUint16(view, offset + i * 12, little) === Marker.Orientation) {
            cb(getUint16(view, offset + i * 12 + 8, little));
            return;
          }
        }
      } else if ((marker & Marker.Unknown) !== Marker.Unknown) {
        // Invalid
        break;
      } else {
        offset += getUint16(view, offset);
      }
    }

    // Nothing found
    cb(-1);
  };

  // we don't need to read the entire file to get the orientation
  reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
};

const createImagePreviewView = fpAPI => {
  const didCalculatePreviewSize = ({ root, props, action }) => {
    // calculate scale ratio
    const scaleFactor = root.rect.element.width / action.width;

    // scale panel
    props.height = action.height * scaleFactor;
  };

  const didLoadPreview = ({ root, props }) => {
    const { overlay } = root.ref;

    // reveal overlay
    overlay.opacity = 1;
  };

  const didDrawPreview = ({ root, props }) => {
    const { image } = root.ref;

    // reveal image
    image.scaleX = 1.0;
    image.scaleY = 1.0;
    image.opacity = 1;
  };

  const create = ({ root, props, dispatch }) => {
    const { utils, views } = fpAPI;
    const { createView, createWorker, loadImage } = utils;
    const { id } = props;

    // image view
    const image = createImagePresenterView(fpAPI);

    // append image presenter
    root.ref.image = root.appendChildView(
      root.createChildView(image, {
        id: props.id,
        scaleX: 1.25,
        scaleY: 1.25,
        opacity: 0
      })
    );

    // image overlay
    const overlay = createImageOverlayView(fpAPI);

    // append image overlay
    root.ref.overlay = root.appendChildView(
      root.createChildView(overlay, {
        opacity: 0
      })
    );

    // we need to get the file data to determine the eventual image size
    const item = root.query('GET_ITEM', id);

    // fallback
    const loadPreviewFallback = (item, width, height, orientation) => {
      // let's scale the image in the main thread :(
      loadImage(item.fileURL).then(image => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);

        previewImageLoaded(canvas, width, height, orientation);
      });
    };

    // image is now ready
    const previewImageLoaded = (data, width, height, orientation) => {
      root.dispatch('DID_LOAD_PREVIEW_IMAGE', {
        id,
        data,
        width,
        height,
        orientation
      });
    };

    // we need to check the rotation of the image
    getImageOrientation(item.file, orientation => {
      // determine image size of this item
      getImageScaledSize(item.fileURL, 700, 700, (width, height) => {
        // if is rotated incorrectly swap width and height
        if (orientation >= 5 && orientation <= 8) {
          [width, height] = [height, width];
        }

        // let writer know
        root.dispatch('DID_CALCULATE_PREVIEW_IMAGE_SIZE', {
          id,
          width,
          height
        });

        // if we support scaling using createImageBitmap we use a worker
        if ('createImageBitmap' in window) {
          // let's scale the image in a worker
          const worker = createWorker(BitmapWorker);
          worker.post(
            {
              file: item.file,
              resizeWidth: width,
              resizeHeight: height
            },
            imageBitmap => {
              // no bitmap returned, must be something wrong, try the oldschool way
              if (!imageBitmap) {
                loadPreviewFallback(item, width, height, orientation);
                return;
              }

              // yay we got our bitmap, let's continue showing the preview
              previewImageLoaded(imageBitmap, width, height, orientation);
            }
          );
        } else {
          // create fallback preview
          loadPreviewFallback(item, width, height, orientation);
        }
      });
    });
  };

  return fpAPI.utils.createView({
    name: 'image-preview-wrapper',
    create,
    write: fpAPI.utils.createRoute({
      DID_CALCULATE_PREVIEW_IMAGE_SIZE: didCalculatePreviewSize,
      DID_LOAD_PREVIEW_IMAGE: didLoadPreview,
      DID_DRAW_PREVIEW_IMAGE: didDrawPreview
    }),
    mixins: {
      apis: ['height'],
      animations: {
        height: 'spring'
      }
    }
  });
};

/**
 * Image Preview Plugin
 */
var plugin$1 = fpAPI => {
  const { addFilter, utils } = fpAPI;
  const { Type, createRoute } = utils;
  const imagePreview = createImagePreviewView(fpAPI);

  // adds options to options register
  addFilter('SET_DEFAULT_OPTIONS', options =>
    Object.assign(options, {
      // Enable or disable image preview
      allowImagePreview: [true, Type.BOOLEAN],

      // Max size of preview file for when createImageBitmap is not supported
      maxPreviewFileSize: [null, Type.INT]
    })
  );

  // called for each view that is created right after the 'create' method
  addFilter('CREATE_VIEW', viewAPI => {
    // get reference to created view
    const { is, view, query } = viewAPI;

    // only hook up to item view and only if is enabled for this cropper
    if (!is('file') || !query('GET_ALLOW_IMAGE_PREVIEW')) {
      return;
    }

    // create the image preview plugin, but only do so if the item is an image
    const didLoadItem = ({ root, props, actions }) => {
      const { id } = props;
      const item = query('GET_ITEM', id);

      // item could theoretically have been removed in the mean time
      if (!item) {
        return;
      }

      // get the file object
      const file = item.file;

      // exit if this is not an image
      if (!isPreviewableImage(file)) {
        return;
      }

      // exit if image size is too high and no createImageBitmap support
      const supportsCreateImageBitmap = 'createImageBitmap' in (window || {});
      const maxPreviewFileSize = query('GET_MAX_PREVIEW_FILE_SIZE');
      if (
        !supportsCreateImageBitmap &&
        maxPreviewFileSize &&
        file.size > maxPreviewFileSize
      ) {
        return;
      }

      // set panel
      const { panel } = fpAPI.views;
      root.ref.panel = view.appendChildView(view.createChildView(panel));
      root.ref.panel.element.classList.add('filepond--panel-item');

      // set preview view
      root.ref.imagePreview = view.appendChildView(
        view.createChildView(imagePreview, { id, height: 10 })
      );
    };

    const route = createRoute({
      DID_LOAD_ITEM: didLoadItem
    });

    const writer = ({ root, props, actions }) => {
      route({ root, props, actions });

      if (!root.ref.panel) {
        return;
      }

      root.ref.panel.height = root.ref.imagePreview.height;
    };

    // start writing
    view.registerWriter(writer);
  });
};

if (document) {
  // plugin has loaded
  document.dispatchEvent(
    new CustomEvent('FilePond:pluginloaded', { detail: plugin$1 })
  );
}

export default plugin$1;
