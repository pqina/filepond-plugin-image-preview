/*!
 * FilePondPluginImagePreview 4.1.1
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

// test if file is of type image and can be viewed in canvas
const isPreviewableImage = file => /^image/.test(file.type);

const IMAGE_SCALE_SPRING_PROPS = {
  type: 'spring',
  stiffness: 0.5,
  damping: 0.45,
  mass: 10
};

const createVector = (x, y) => ({ x, y });

const vectorDot = (a, b) => a.x * b.x + a.y * b.y;

const vectorSubtract = (a, b) => createVector(a.x - b.x, a.y - b.y);

const vectorDistanceSquared = (a, b) =>
  vectorDot(vectorSubtract(a, b), vectorSubtract(a, b));

const vectorDistance = (a, b) => Math.sqrt(vectorDistanceSquared(a, b));

const getOffsetPointOnEdge = (length, rotation) => {
  const a = length;

  const A = 1.5707963267948966;
  const B = rotation;
  const C = 1.5707963267948966 - rotation;

  const sinA = Math.sin(A);
  const sinB = Math.sin(B);
  const sinC = Math.sin(C);
  const cosC = Math.cos(C);
  const ratio = a / sinA;
  const b = ratio * sinB;
  const c = ratio * sinC;

  return createVector(cosC * b, cosC * c);
};

const getRotatedRectSize = (rect, rotation) => {
  const w = rect.width;
  const h = rect.height;

  const hor = getOffsetPointOnEdge(w, rotation);
  const ver = getOffsetPointOnEdge(h, rotation);

  const tl = createVector(rect.x + Math.abs(hor.x), rect.y - Math.abs(hor.y));

  const tr = createVector(
    rect.x + rect.width + Math.abs(ver.y),
    rect.y + Math.abs(ver.x)
  );

  const bl = createVector(
    rect.x - Math.abs(ver.y),
    rect.y + rect.height - Math.abs(ver.x)
  );

  return {
    width: vectorDistance(tl, tr),
    height: vectorDistance(tl, bl)
  };
};

const getImageRectZoomFactor = (imageRect, cropRect, rotation, center) => {
  // calculate available space round image center position
  const cx = center.x > 0.5 ? 1 - center.x : center.x;
  const cy = center.y > 0.5 ? 1 - center.y : center.y;
  const imageWidth = cx * 2 * imageRect.width;
  const imageHeight = cy * 2 * imageRect.height;

  // calculate rotated crop rectangle size
  const rotatedCropSize = getRotatedRectSize(cropRect, rotation);

  // calculate scalar required to fit image
  return Math.max(
    rotatedCropSize.width / imageWidth,
    rotatedCropSize.height / imageHeight
  );
};

const getCenteredCropRect = (container, aspectRatio) => {
  let width = container.width;
  let height = width * aspectRatio;
  if (height > container.height) {
    height = container.height;
    width = height / aspectRatio;
  }
  const x = (container.width - width) * 0.5;
  const y = (container.height - height) * 0.5;

  return {
    x,
    y,
    width,
    height
  };
};

// does horizontal and vertical flipping
const createBitmapView = _ =>
  _.utils.createView({
    name: 'image-bitmap',
    ignoreRect: true,
    mixins: { styles: ['scaleX', 'scaleY'] },
    create: ({ root, props }) => {
      root.appendChild(props.image);
    }
  });

// shifts and rotates image
const createImageCanvasWrapper = _ =>
  _.utils.createView({
    name: 'image-canvas-wrapper',
    tag: 'div',
    ignoreRect: true,
    mixins: {
      apis: ['crop', 'width', 'height'],
      styles: [
        'originX',
        'originY',
        'translateX',
        'translateY',
        'scaleX',
        'scaleY',
        'rotateZ'
      ],
      animations: {
        originX: IMAGE_SCALE_SPRING_PROPS,
        originY: IMAGE_SCALE_SPRING_PROPS,
        scaleX: IMAGE_SCALE_SPRING_PROPS,
        scaleY: IMAGE_SCALE_SPRING_PROPS,
        translateX: IMAGE_SCALE_SPRING_PROPS,
        translateY: IMAGE_SCALE_SPRING_PROPS,
        rotateZ: IMAGE_SCALE_SPRING_PROPS
      }
    },
    create: ({ root, props }) => {
      props.width = props.image.width;
      props.height = props.image.height;
      root.ref.bitmap = root.appendChildView(
        root.createChildView(createBitmapView(_), { image: props.image })
      );
    },
    write: ({ root, props }) => {
      const { flip } = props.crop;
      const { bitmap } = root.ref;
      bitmap.scaleX = flip.horizontal ? -1 : 1;
      bitmap.scaleY = flip.vertical ? -1 : 1;
    }
  });

// clips canvas to correct aspect ratio
const createClipView = _ =>
  _.utils.createView({
    name: 'image-clip',
    tag: 'div',
    ignoreRect: true,
    mixins: {
      apis: ['crop', 'width', 'height'],
      styles: ['width', 'height', 'opacity'],
      animations: {
        opacity: { type: 'tween', duration: 250 }
      }
    },
    create: ({ root, props }) => {
      root.ref.image = root.appendChildView(
        root.createChildView(
          createImageCanvasWrapper(_),
          Object.assign({}, props)
        )
      );

      // set up transparency grid
      const transparencyIndicator = root.query(
        'GET_IMAGE_PREVIEW_TRANSPARENCY_INDICATOR'
      );
      if (transparencyIndicator === null) {
        return;
      }

      // grid pattern
      if (transparencyIndicator === 'grid') {
        root.element.dataset.transparencyIndicator = transparencyIndicator;
      }
      // basic color
      else {
        root.element.dataset.transparencyIndicator = 'color';
      }
    },
    write: ({ root, props, shouldOptimize }) => {
      const { crop, width, height } = props;

      root.ref.image.crop = crop;

      const stage = {
        x: 0,
        y: 0,
        width,
        height,
        center: {
          x: width * 0.5,
          y: height * 0.5
        }
      };

      const image = {
        width: root.ref.image.width,
        height: root.ref.image.height
      };

      const origin = {
        x: crop.center.x * image.width,
        y: crop.center.y * image.height
      };

      const translation = {
        x: stage.center.x - image.width * crop.center.x,
        y: stage.center.y - image.height * crop.center.y
      };

      const rotation = Math.PI * 2 + (crop.rotation % (Math.PI * 2));

      const cropAspectRatio = crop.aspectRatio || image.height / image.width;

      const stageZoomFactor = getImageRectZoomFactor(
        image,
        getCenteredCropRect(stage, cropAspectRatio),
        rotation,
        crop.center
      );

      const scale = crop.zoom * stageZoomFactor;

      const imageView = root.ref.image;

      // don't update clip layout
      if (shouldOptimize) {
        imageView.originX = null;
        imageView.originY = null;
        imageView.translateX = null;
        imageView.translateY = null;
        imageView.rotateZ = null;
        imageView.scaleX = null;
        imageView.scaleY = null;
        return;
      }

      imageView.originX = origin.x;
      imageView.originY = origin.y;
      imageView.translateX = translation.x;
      imageView.translateY = translation.y;
      imageView.rotateZ = rotation;
      imageView.scaleX = scale;
      imageView.scaleY = scale;
    }
  });

const createImageView = _ =>
  _.utils.createView({
    name: 'image-preview',
    tag: 'div',
    ignoreRect: true,
    mixins: {
      apis: ['crop', 'image'],
      styles: ['translateY', 'scaleX', 'scaleY', 'opacity'],
      animations: {
        scaleX: IMAGE_SCALE_SPRING_PROPS,
        scaleY: IMAGE_SCALE_SPRING_PROPS,
        translateY: IMAGE_SCALE_SPRING_PROPS,
        opacity: { type: 'tween', duration: 400 }
      }
    },
    create: ({ root, props }) => {
      root.ref.clip = root.appendChildView(
        root.createChildView(createClipView(_), {
          image: props.image,
          crop: props.crop
        })
      );
    },
    write: ({ root, props, shouldOptimize }) => {
      const { clip } = root.ref;

      const { crop, image } = props;

      clip.crop = crop;

      // don't update clip layout
      clip.opacity = shouldOptimize ? 0 : 1;

      // don't re-render if optimizing or hidden (width will be zero resulting in weird animations)
      if (shouldOptimize || root.rect.element.hidden) return;

      // calculate scaled preview image size
      const imageAspectRatio = image.height / image.width;
      let aspectRatio = crop.aspectRatio || imageAspectRatio;

      // calculate container size
      const containerWidth = root.rect.inner.width;
      const containerHeight = root.rect.inner.height;

      let fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
      const minPreviewHeight = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
      const maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

      const panelAspectRatio = root.query('GET_PANEL_ASPECT_RATIO');
      const allowMultiple = root.query('GET_ALLOW_MULTIPLE');

      if (panelAspectRatio && !allowMultiple) {
        fixedPreviewHeight = containerWidth * panelAspectRatio;
        aspectRatio = panelAspectRatio;
      }

      // determine clip width and height
      let clipHeight =
        fixedPreviewHeight !== null
          ? fixedPreviewHeight
          : Math.max(
              minPreviewHeight,
              Math.min(containerWidth * aspectRatio, maxPreviewHeight)
            );

      let clipWidth = clipHeight / aspectRatio;
      if (clipWidth > containerWidth) {
        clipWidth = containerWidth;
        clipHeight = clipWidth * aspectRatio;
      }

      if (clipHeight > containerHeight) {
        clipHeight = containerHeight;
        clipWidth = containerHeight / aspectRatio;
      }

      clip.width = clipWidth;
      clip.height = clipHeight;
    }
  });

let SVG_MASK = `<svg width="500" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">
    <defs>
        <radialGradient id="gradient-__UID__" cx=".5" cy="1.25" r="1.15">
            <stop offset='50%' stop-color='#000000'/>
            <stop offset='56%' stop-color='#0a0a0a'/>
            <stop offset='63%' stop-color='#262626'/>
            <stop offset='69%' stop-color='#4f4f4f'/>
            <stop offset='75%' stop-color='#808080'/>
            <stop offset='81%' stop-color='#b1b1b1'/>
            <stop offset='88%' stop-color='#dadada'/>
            <stop offset='94%' stop-color='#f6f6f6'/>
            <stop offset='100%' stop-color='#ffffff'/>
        </radialGradient>
        <mask id="mask-__UID__">
            <rect x="0" y="0" width="500" height="200" fill="url(#gradient-__UID__)"></rect>
        </mask>
    </defs>
    <rect x="0" width="500" height="200" fill="currentColor" mask="url(#mask-__UID__)"></rect>
</svg>`;

let checkedMyBases = false;
let SVGMaskUniqueId = 0;

const createImageOverlayView = fpAPI =>
  fpAPI.utils.createView({
    name: 'image-preview-overlay',
    tag: 'div',
    ignoreRect: true,
    create: ({ root, props }) => {
      if (!checkedMyBases && document.querySelector('base')) {
        SVG_MASK = SVG_MASK.replace(
          /url\(\#/g,
          'url(' + window.location.href.replace(window.location.hash, '') + '#'
        );
        checkedMyBases = true;
      }

      SVGMaskUniqueId++;
      root.element.classList.add(
        `filepond--image-preview-overlay-${props.status}`
      );
      root.element.innerHTML = SVG_MASK.replace(/__UID__/g, SVGMaskUniqueId);
    },
    mixins: {
      styles: ['opacity'],
      animations: {
        opacity: { type: 'spring', mass: 25 }
      }
    }
  });

/**
 * Bitmap Worker
 */
const BitmapWorker = function() {
  self.onmessage = e => {
    createImageBitmap(e.data.message.file).then(bitmap => {
      self.postMessage({ id: e.data.id, message: bitmap }, [bitmap]);
    });
  };
};

const getImageSize = (url, cb) => {
  let image = new Image();
  image.onload = () => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    image = null;
    cb(width, height);
  };
  image.src = url;
};

const transforms = {
  1: () => [1, 0, 0, 1, 0, 0],
  2: width => [-1, 0, 0, 1, width, 0],
  3: (width, height) => [-1, 0, 0, -1, width, height],
  4: (width, height) => [1, 0, 0, -1, 0, height],
  5: () => [0, 1, 1, 0, 0, 0],
  6: (width, height) => [0, 1, -1, 0, height, 0],
  7: (width, height) => [0, -1, -1, 0, height, width],
  8: width => [0, -1, 1, 0, 0, width]
};

const fixImageOrientation = (ctx, width, height, orientation) => {
  // no orientation supplied
  if (orientation === -1) {
    return;
  }

  ctx.transform.apply(ctx, transforms[orientation](width, height));
};

// draws the preview image to canvas
const createPreviewImage = (data, width, height, orientation) => {
  // can't draw on half pixels
  width = Math.round(width);
  height = Math.round(height);

  // draw image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // if is rotated incorrectly swap width and height
  if (orientation >= 5 && orientation <= 8) {
    [width, height] = [height, width];
  }

  // correct image orientation
  fixImageOrientation(ctx, width, height, orientation);

  // draw the image
  ctx.drawImage(data, 0, 0, width, height);

  return canvas;
};

const isBitmap = file => /^image/.test(file.type) && !/svg/.test(file.type);

const MAX_WIDTH = 10;
const MAX_HEIGHT = 10;

const calculateAverageColor = image => {
  const scalar = Math.min(MAX_WIDTH / image.width, MAX_HEIGHT / image.height);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = (canvas.width = Math.ceil(image.width * scalar));
  const height = (canvas.height = Math.ceil(image.height * scalar));
  ctx.drawImage(image, 0, 0, width, height);
  let data = null;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch (e) {
    return null;
  }
  const l = data.length;

  let r = 0;
  let g = 0;
  let b = 0;
  let i = 0;

  for (; i < l; i += 4) {
    r += data[i] * data[i];
    g += data[i + 1] * data[i + 1];
    b += data[i + 2] * data[i + 2];
  }

  r = averageColor(r, l);
  g = averageColor(g, l);
  b = averageColor(b, l);

  return { r, g, b };
};

const averageColor = (c, l) => Math.floor(Math.sqrt(c / (l / 4)));

const cloneCanvas = (origin, target) => {
  target = target || document.createElement('canvas');
  target.width = origin.width;
  target.height = origin.height;
  const ctx = target.getContext('2d');
  ctx.drawImage(origin, 0, 0);
  return target;
};

const loadImage = url =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      resolve(img);
    };
    img.onerror = e => {
      reject(e);
    };
    img.src = url;
  });

const createImageWrapperView = _ => {
  // create overlay view
  const OverlayView = createImageOverlayView(_);

  const ImageView = createImageView(_);

  const removeImageView = (root, imageView) => {
    root.removeChildView(imageView);
    imageView.image.width = 1;
    imageView.image.height = 1;
    imageView._destroy();
  };

  // remove an image
  const shiftImage = ({ root }) => {
    const imageView = root.ref.images.shift();
    imageView.opacity = 0;
    imageView.translateY = -15;
    root.ref.imageViewBin.push(imageView);
    return imageView;
  };

  // add new image
  const pushImage = ({ root, props, image }) => {
    const id = props.id;
    const item = root.query('GET_ITEM', { id });
    if (!item) return;

    const crop = item.getMetadata('crop') || {
      center: {
        x: 0.5,
        y: 0.5
      },
      flip: {
        horizontal: false,
        vertical: false
      },
      zoom: 1,
      rotation: 0,
      aspectRatio: null
    };

    // append image presenter
    const imageView = root.appendChildView(
      root.createChildView(ImageView, {
        image,
        crop,
        opacity: 0,
        scaleX: 1.15,
        scaleY: 1.15,
        translateY: 15
      }),
      root.childViews.length
    );
    root.ref.images.push(imageView);

    // reveal the preview image
    imageView.opacity = 1;
    imageView.scaleX = 1;
    imageView.scaleY = 1;
    imageView.translateY = 0;

    // the preview is now ready to be drawn
    setTimeout(() => {
      root.dispatch('DID_IMAGE_PREVIEW_SHOW', { id });
    }, 250);
  };

  const updateImage = ({ root, props }) => {
    const item = root.query('GET_ITEM', { id: props.id });
    if (!item) return;
    const imageView = root.ref.images[root.ref.images.length - 1];
    imageView.crop = item.getMetadata('crop');
  };

  // replace image preview
  const didUpdateItemMetadata = ({ root, props, action }) => {
    if (action.change.key !== 'crop' || !root.ref.images.length) {
      return;
    }

    const item = root.query('GET_ITEM', { id: props.id });
    if (!item) return;

    const crop = item.getMetadata('crop');
    const image = root.ref.images[root.ref.images.length - 1];

    // if aspect ratio has changed, we need to create a new image
    if (Math.abs(crop.aspectRatio - image.crop.aspectRatio) > 0.00001) {
      const imageView = shiftImage({ root });
      pushImage({ root, props, image: cloneCanvas(imageView.image) });
    }
    // if not, we can update the current image
    else {
      updateImage({ root, props });
    }
  };

  const canCreateImageBitmap = file =>
    'createImageBitmap' in window && isBitmap(file);

  /**
   * Write handler for when preview container has been created
   */
  const didCreatePreviewContainer = ({ root, props }) => {
    const { id } = props;

    // we need to get the file data to determine the eventual image size
    const item = root.query('GET_ITEM', id);
    if (!item) return;

    // get url to file (we'll revoke it later on when done)
    const fileURL = URL.createObjectURL(item.file);

    // determine image size of this item
    getImageSize(fileURL, (width, height) => {
      // we can now scale the panel to the final size
      root.dispatch('DID_IMAGE_PREVIEW_CALCULATE_SIZE', {
        id,
        width,
        height
      });
    });
  };

  const drawPreview = ({ root, props }) => {
    const { utils } = _;
    const { createWorker } = utils;
    const { id } = props;

    // we need to get the file data to determine the eventual image size
    const item = root.query('GET_ITEM', id);
    if (!item) return;

    // get url to file (we'll revoke it later on when done)
    const fileURL = URL.createObjectURL(item.file);

    // fallback
    const loadPreviewFallback = () => {
      // let's scale the image in the main thread :(
      loadImage(fileURL).then(previewImageLoaded);
    };

    // image is now ready
    const previewImageLoaded = data => {
      // the file url is no longer needed
      URL.revokeObjectURL(fileURL);

      // draw the scaled down version here and use that as source so bitmapdata can be closed
      // orientation info
      const exif = item.getMetadata('exif') || {};
      const orientation = exif.orientation || -1;

      // get width and height from action, and swap if orientation is incorrect
      let { width, height } = data;
      if (orientation >= 5 && orientation <= 8) {
        [width, height] = [height, width];
      }

      // scale canvas based on pixel density
      // we multiply by .75 as that creates smaller but still clear images on screens with high res displays
      const pixelDensityFactor = Math.max(1, window.devicePixelRatio * 0.75);

      // we want as much pixels to work with as possible,
      // this multiplies the minimum image resolution,
      // so when zooming in it doesn't get too blurry
      const zoomFactor = root.query('GET_IMAGE_PREVIEW_ZOOM_FACTOR');

      // imaeg scale factor
      const scaleFactor = zoomFactor * pixelDensityFactor;

      // calculate scaled preview image size
      const previewImageRatio = height / width;

      // calculate image preview height and width
      const previewContainerWidth = root.rect.element.width;
      const previewContainerHeight = root.rect.element.height;

      let imageWidth = previewContainerWidth;
      let imageHeight = imageWidth * previewImageRatio;

      if (previewImageRatio > 1) {
        imageWidth = Math.min(width, previewContainerWidth * scaleFactor);
        imageHeight = imageWidth * previewImageRatio;
      } else {
        imageHeight = Math.min(height, previewContainerHeight * scaleFactor);
        imageWidth = imageHeight / previewImageRatio;
      }

      // transfer to image tag so no canvas memory wasted on iOS
      const previewImage = createPreviewImage(
        data,
        imageWidth,
        imageHeight,
        orientation
      );

      // calculate average image color, disabled for now
      const averageColor = root.query(
        'GET_IMAGE_PREVIEW_CALCULATE_AVERAGE_IMAGE_COLOR'
      )
        ? calculateAverageColor(data)
        : null;
      item.setMetadata('color', averageColor, true);

      // data has been transferred to canvas ( if was ImageBitmap )
      if ('close' in data) {
        data.close();
      }

      // show the overlay
      root.ref.overlayShadow.opacity = 1;

      // create the first image
      pushImage({ root, props, image: previewImage });
    };

    // if we support scaling using createImageBitmap we use a worker
    if (canCreateImageBitmap(item.file)) {
      // let's scale the image in a worker
      const worker = createWorker(BitmapWorker);

      worker.post(
        {
          file: item.file
        },
        imageBitmap => {
          // destroy worker
          worker.terminate();

          // no bitmap returned, must be something wrong,
          // try the oldschool way
          if (!imageBitmap) {
            loadPreviewFallback();
            return;
          }

          // yay we got our bitmap, let's continue showing the preview
          previewImageLoaded(imageBitmap);
        }
      );
    } else {
      // create fallback preview
      loadPreviewFallback();
    }
  };

  /**
   * Write handler for when the preview image is ready to be animated
   */
  const didDrawPreview = ({ root }) => {
    // get last added image
    const image = root.ref.images[root.ref.images.length - 1];
    image.translateY = 0;
    image.scaleX = 1.0;
    image.scaleY = 1.0;
    image.opacity = 1;
  };

  /**
   * Write handler for when the preview has been loaded
   */
  const restoreOverlay = ({ root }) => {
    root.ref.overlayShadow.opacity = 1;
    root.ref.overlayError.opacity = 0;
    root.ref.overlaySuccess.opacity = 0;
  };

  const didThrowError = ({ root }) => {
    root.ref.overlayShadow.opacity = 0.25;
    root.ref.overlayError.opacity = 1;
  };

  const didCompleteProcessing = ({ root }) => {
    root.ref.overlayShadow.opacity = 0.25;
    root.ref.overlaySuccess.opacity = 1;
  };

  /**
   * Constructor
   */
  const create = ({ root }) => {
    // image view
    root.ref.images = [];

    // image bin
    root.ref.imageViewBin = [];

    // image overlays
    root.ref.overlayShadow = root.appendChildView(
      root.createChildView(OverlayView, {
        opacity: 0,
        status: 'idle'
      })
    );

    root.ref.overlaySuccess = root.appendChildView(
      root.createChildView(OverlayView, {
        opacity: 0,
        status: 'success'
      })
    );

    root.ref.overlayError = root.appendChildView(
      root.createChildView(OverlayView, {
        opacity: 0,
        status: 'failure'
      })
    );
  };

  return _.utils.createView({
    name: 'image-preview-wrapper',
    create,
    styles: ['height'],
    apis: ['height'],
    destroy: ({ root }) => {
      // we resize the image so memory on iOS 12 is released more quickly (it seems)
      root.ref.images.forEach(imageView => {
        imageView.image.width = 1;
        imageView.image.height = 1;
      });
    },
    write: _.utils.createRoute(
      {
        // image preview stated
        DID_IMAGE_PREVIEW_DRAW: didDrawPreview,
        DID_IMAGE_PREVIEW_CONTAINER_CREATE: didCreatePreviewContainer,
        DID_FINISH_CALCULATE_PREVIEWSIZE: drawPreview,
        DID_UPDATE_ITEM_METADATA: didUpdateItemMetadata,

        // file states
        DID_THROW_ITEM_LOAD_ERROR: didThrowError,
        DID_THROW_ITEM_PROCESSING_ERROR: didThrowError,
        DID_THROW_ITEM_INVALID: didThrowError,
        DID_COMPLETE_ITEM_PROCESSING: didCompleteProcessing,
        DID_START_ITEM_PROCESSING: restoreOverlay,
        DID_REVERT_ITEM_PROCESSING: restoreOverlay
      },
      ({ root }) => {
        // views on death row
        const viewsToRemove = root.ref.imageViewBin.filter(
          imageView => imageView.opacity === 0
        );

        // views to retain
        root.ref.imageViewBin = root.ref.imageViewBin.filter(
          imageView => imageView.opacity > 0
        );

        // remove these views
        viewsToRemove.forEach(imageView => removeImageView(root, imageView));
        viewsToRemove.length = 0;
      }
    )
  });
};

/**
 * Image Preview Plugin
 */

const plugin = fpAPI => {
  const { addFilter, utils } = fpAPI;
  const { Type, createRoute, isFile } = utils;

  // imagePreviewView
  const imagePreviewView = createImageWrapperView(fpAPI);

  // called for each view that is created right after the 'create' method
  addFilter('CREATE_VIEW', viewAPI => {
    // get reference to created view
    const { is, view, query } = viewAPI;

    // only hook up to item view and only if is enabled for this cropper
    if (!is('file') || !query('GET_ALLOW_IMAGE_PREVIEW')) {
      return;
    }

    // create the image preview plugin, but only do so if the item is an image
    const didLoadItem = ({ root, props }) => {
      const { id } = props;
      const item = query('GET_ITEM', id);

      // item could theoretically have been removed in the mean time
      if (!item || !isFile(item.file) || item.archived) return;

      // get the file object
      const file = item.file;

      // exit if this is not an image
      if (!isPreviewableImage(file)) return;

      // exit if image size is too high and no createImageBitmap support
      // this would simply bring the browser to its knees and that is not what we want
      const supportsCreateImageBitmap = 'createImageBitmap' in (window || {});
      const maxPreviewFileSize = query('GET_IMAGE_PREVIEW_MAX_FILE_SIZE');
      if (
        !supportsCreateImageBitmap &&
        (maxPreviewFileSize && file.size > maxPreviewFileSize)
      )
        return;

      // set preview view
      root.ref.imagePreview = view.appendChildView(
        view.createChildView(imagePreviewView, { id })
      );

      // update height if is fixed
      const fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
      if (fixedPreviewHeight) {
        root.dispatch('DID_UPDATE_PANEL_HEIGHT', {
          id: item.id,
          height: fixedPreviewHeight
        });
      }

      // now ready
      const queue =
        !supportsCreateImageBitmap &&
        file.size > query('GET_IMAGE_PREVIEW_MAX_INSTANT_PREVIEW_FILE_SIZE');
      root.dispatch('DID_IMAGE_PREVIEW_CONTAINER_CREATE', { id }, queue);
    };

    const rescaleItem = (root, props) => {
      if (!root.ref.imagePreview) return;

      let { id } = props;

      // get item
      const item = root.query('GET_ITEM', { id });
      if (!item) return;

      // if is fixed height or panel has aspect ratio, exit here, height has already been defined
      const panelAspectRatio = root.query('GET_PANEL_ASPECT_RATIO');
      const itemPanelAspectRatio = root.query('GET_ITEM_PANEL_ASPECT_RATIO');
      const fixedHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
      if (panelAspectRatio || itemPanelAspectRatio || fixedHeight) return;

      // no data!
      let { imageWidth, imageHeight } = root.ref;
      if (!imageWidth || !imageHeight) return;

      // get height min and max
      const minPreviewHeight = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
      const maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

      // orientation info
      const exif = item.getMetadata('exif') || {};
      const orientation = exif.orientation || -1;

      // get width and height from action, and swap of orientation is incorrect
      if (orientation >= 5 && orientation <= 8)
        [imageWidth, imageHeight] = [imageHeight, imageWidth];

      // scale up width and height when we're dealing with an SVG
      if (!isBitmap(item.file) || root.query('GET_IMAGE_PREVIEW_UPSCALE')) {
        const scalar = 2048 / imageWidth;
        imageWidth *= scalar;
        imageHeight *= scalar;
      }

      // image aspect ratio
      const imageAspectRatio = imageHeight / imageWidth;

      // we need the item to get to the crop size
      const previewAspectRatio =
        (item.getMetadata('crop') || {}).aspectRatio || imageAspectRatio;

      // preview height range
      let previewHeightMax = Math.max(
        minPreviewHeight,
        Math.min(imageHeight, maxPreviewHeight)
      );
      const itemWidth = root.rect.element.width;
      const previewHeight = Math.min(
        itemWidth * previewAspectRatio,
        previewHeightMax
      );

      // request update to panel height
      root.dispatch('DID_UPDATE_PANEL_HEIGHT', {
        id: item.id,
        height: previewHeight
      });
    };

    const didResizeView = ({ root }) => {
      // actions in next write operation
      root.ref.shouldRescale = true;
    };

    const didUpdateItemMetadata = ({ root, action }) => {
      if (action.change.key !== 'crop') return;

      // actions in next write operation
      root.ref.shouldRescale = true;
    };

    const didCalculatePreviewSize = ({ root, action }) => {
      // remember dimensions
      root.ref.imageWidth = action.width;
      root.ref.imageHeight = action.height;

      // actions in next write operation
      root.ref.shouldRescale = true;
      root.ref.shouldDrawPreview = true;

      // as image load could take a while and fire when draw loop is resting we need to give it a kick
      root.dispatch('KICK');
    };

    // start writing
    view.registerWriter(
      createRoute(
        {
          DID_RESIZE_ROOT: didResizeView,
          DID_STOP_RESIZE: didResizeView,
          DID_LOAD_ITEM: didLoadItem,
          DID_IMAGE_PREVIEW_CALCULATE_SIZE: didCalculatePreviewSize,
          DID_UPDATE_ITEM_METADATA: didUpdateItemMetadata
        },
        ({ root, props }) => {
          // don't do anything while hidden
          if (root.rect.element.hidden) return;

          // resize the item panel
          if (root.ref.shouldRescale) {
            rescaleItem(root, props);
            root.ref.shouldRescale = false;
          }

          if (root.ref.shouldDrawPreview) {
            // queue till next frame so we're sure the height has been applied this forces the draw image call inside the wrapper view to use the correct height
            requestAnimationFrame(() => {
              root.dispatch('DID_FINISH_CALCULATE_PREVIEWSIZE', {
                id: props.id
              });
            });
            root.ref.shouldDrawPreview = false;
          }
        }
      )
    );
  });

  // expose plugin
  return {
    options: {
      // Enable or disable image preview
      allowImagePreview: [true, Type.BOOLEAN],

      // Fixed preview height
      imagePreviewHeight: [null, Type.INT],

      // Min image height
      imagePreviewMinHeight: [44, Type.INT],

      // Max image height
      imagePreviewMaxHeight: [256, Type.INT],

      // Max size of preview file for when createImageBitmap is not supported
      imagePreviewMaxFileSize: [null, Type.INT],

      // The amount of extra pixels added to the image preview to allow comfortable zooming
      imagePreviewZoomFactor: [2, Type.INT],

      // Should we upscale small images to fit the max bounding box of the preview area
      imagePreviewUpscale: [false, Type.BOOLEAN],

      // Max size of preview file that we allow to try to instant preview if createImageBitmap is not supported, else image is queued for loading
      imagePreviewMaxInstantPreviewFileSize: [1000000, Type.INT],

      // Style of the transparancy indicator used behind images
      imagePreviewTransparencyIndicator: [null, Type.STRING],

      // Enables or disables reading average image color
      imagePreviewCalculateAverageImageColor: [false, Type.BOOLEAN]
    }
  };
};

// fire pluginloaded event if running in browser, this allows registering the plugin when using async script tags
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';
if (isBrowser) {
  document.dispatchEvent(
    new CustomEvent('FilePond:pluginloaded', { detail: plugin })
  );
}

export default plugin;
