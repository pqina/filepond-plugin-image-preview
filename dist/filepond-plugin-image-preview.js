/*
 * FilePondPluginImagePreview 2.0.0
 * Licensed under MIT, https://opensource.org/licenses/MIT
 * Please visit https://pqina.nl/filepond for details.
 */
(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
      ? define(factory)
      : (global.FilePondPluginImagePreview = factory());
})(this, function() {
  'use strict';

  // test if file is of type image and can be viewed in canvas
  var isPreviewableImage = function isPreviewableImage(file) {
    return /^image/.test(file.type);
  }; // && !/svg/.test(file.type);

  var asyncGenerator = (function() {
    function AwaitValue(value) {
      this.value = value;
    }

    function AsyncGenerator(gen) {
      var front, back;

      function send(key, arg) {
        return new Promise(function(resolve, reject) {
          var request = {
            key: key,
            arg: arg,
            resolve: resolve,
            reject: reject,
            next: null
          };

          if (back) {
            back = back.next = request;
          } else {
            front = back = request;
            resume(key, arg);
          }
        });
      }

      function resume(key, arg) {
        try {
          var result = gen[key](arg);
          var value = result.value;

          if (value instanceof AwaitValue) {
            Promise.resolve(value.value).then(
              function(arg) {
                resume('next', arg);
              },
              function(arg) {
                resume('throw', arg);
              }
            );
          } else {
            settle(result.done ? 'return' : 'normal', result.value);
          }
        } catch (err) {
          settle('throw', err);
        }
      }

      function settle(type, value) {
        switch (type) {
          case 'return':
            front.resolve({
              value: value,
              done: true
            });
            break;

          case 'throw':
            front.reject(value);
            break;

          default:
            front.resolve({
              value: value,
              done: false
            });
            break;
        }

        front = front.next;

        if (front) {
          resume(front.key, front.arg);
        } else {
          back = null;
        }
      }

      this._invoke = send;

      if (typeof gen.return !== 'function') {
        this.return = undefined;
      }
    }

    if (typeof Symbol === 'function' && Symbol.asyncIterator) {
      AsyncGenerator.prototype[Symbol.asyncIterator] = function() {
        return this;
      };
    }

    AsyncGenerator.prototype.next = function(arg) {
      return this._invoke('next', arg);
    };

    AsyncGenerator.prototype.throw = function(arg) {
      return this._invoke('throw', arg);
    };

    AsyncGenerator.prototype.return = function(arg) {
      return this._invoke('return', arg);
    };

    return {
      wrap: function(fn) {
        return function() {
          return new AsyncGenerator(fn.apply(this, arguments));
        };
      },
      await: function(value) {
        return new AwaitValue(value);
      }
    };
  })();

  var toConsumableArray = function(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++)
        arr2[i] = arr[i];

      return arr2;
    } else {
      return Array.from(arr);
    }
  };

  var transforms = {
    1: function _() {
      return [1, 0, 0, 1, 0, 0];
    },
    2: function _(width) {
      return [-1, 0, 0, 1, width, 0];
    },
    3: function _(width, height) {
      return [-1, 0, 0, -1, width, height];
    },
    4: function _(width, height) {
      return [1, 0, 0, -1, 0, height];
    },
    5: function _() {
      return [0, 1, 1, 0, 0, 0];
    },
    6: function _(width, height) {
      return [0, 1, -1, 0, height, 0];
    },
    7: function _(width, height) {
      return [0, -1, -1, 0, height, width];
    },
    8: function _(width) {
      return [0, -1, 1, 0, 0, width];
    }
  };

  var fixImageOrientation = function fixImageOrientation(
    ctx,
    width,
    height,
    orientation
  ) {
    // no orientation supplied
    if (orientation === -1) {
      return;
    }

    ctx.transform.apply(
      ctx,
      toConsumableArray(transforms[orientation](width, height))
    );
  };

  // draws the preview image
  var createPreviewImage = function createPreviewImage(
    data,
    width,
    height,
    orientation
  ) {
    // round
    width = Math.round(width);
    height = Math.round(height);

    // width and height have already been swapped earlier
    // if orientation was in range below, let's swap back to make
    // this code a bit more readable
    if (orientation >= 5 && orientation <= 8) {
      var _ref = [height, width];
      width = _ref[0];
      height = _ref[1];
    }

    // draw image
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

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

    // data has been transferred to canvas ( if was ImageBitmap )
    if ('close' in data) {
      data.close();
    }

    return canvas;
  };

  var isBitmap = function isBitmap(file) {
    return /^image/.test(file.type) && !/svg/.test(file.type);
  };

  var IMAGE_SCALE_SPRING_PROPS = {
    type: 'spring',
    stiffness: 0.5,
    damping: 0.45,
    mass: 10
  };

  var createImageView = function createImageView(fpAPI) {
    return fpAPI.utils.createView({
      name: 'image-preview',
      tag: 'div',
      ignoreRect: true,
      create: function create(_ref) {
        var root = _ref.root;

        root.ref.clip = document.createElement('div');
        root.element.appendChild(root.ref.clip);

        var transparencyIndicator = root.query(
          'GET_IMAGE_PREVIEW_TRANSPARENCY_INDICATOR'
        );
        if (transparencyIndicator === null) {
          return;
        }

        // grid pattern
        if (transparencyIndicator === 'grid') {
          root.element.dataset.transparencyIndicator = transparencyIndicator;
        } else {
          // basic color
          root.element.dataset.transparencyIndicator = 'color';
        }
      },
      write: fpAPI.utils.createRoute({
        DID_IMAGE_PREVIEW_LOAD: function DID_IMAGE_PREVIEW_LOAD(_ref2) {
          var root = _ref2.root,
            props = _ref2.props,
            action = _ref2.action;
          var id = props.id;

          // get item

          var item = root.query('GET_ITEM', { id: props.id });

          // should render background color
          var transparencyIndicator = root.query(
            'GET_IMAGE_PREVIEW_TRANSPARENCY_INDICATOR'
          );

          // orientation info
          var exif = item.getMetadata('exif') || {};
          var orientation = exif.orientation || -1;

          // get width and height from action, and swap of orientation is incorrect
          var _action$data = action.data,
            width = _action$data.width,
            height = _action$data.height;

          if (orientation >= 5 && orientation <= 8) {
            var _ref3 = [height, width];
            width = _ref3[0];
            height = _ref3[1];
          }

          // get item props
          var crop = item.getMetadata('crop') || {
            rect: {
              x: 0,
              y: 0,
              width: 1,
              height: 1
            },
            aspectRatio: height / width
          };

          // scale canvas based on pixel density
          var pixelDensityFactor = window.devicePixelRatio;

          // the max height of the preview container
          var fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
          var minPreviewHeight = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
          var maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

          // calculate scaled preview image size
          var containerWidth = root.rect.inner.width;
          var previewImageRatio = height / width;
          var previewWidth = containerWidth;
          var previewHeight = containerWidth * previewImageRatio;

          // calculate image preview height and width
          var imageHeight =
            fixedPreviewHeight !== null
              ? fixedPreviewHeight
              : Math.max(minPreviewHeight, Math.min(height, maxPreviewHeight));
          var imageWidth = imageHeight / previewImageRatio;

          // render scaled preview image
          var previewImage = isBitmap(item.file)
            ? createPreviewImage(
                action.data,
                imageWidth * pixelDensityFactor,
                imageHeight * pixelDensityFactor,
                orientation
              )
            : action.data;

          // calculate crop container size
          var clipHeight =
            fixedPreviewHeight !== null
              ? fixedPreviewHeight
              : Math.max(
                  minPreviewHeight,
                  Math.min(containerWidth * crop.aspectRatio, maxPreviewHeight)
                );

          var clipWidth = clipHeight / crop.aspectRatio;
          if (clipWidth > previewWidth) {
            clipWidth = previewWidth;
            clipHeight = clipWidth * crop.aspectRatio;
          }

          // calculate scalar based on if the clip rectangle has been scaled down
          var previewScalar = clipHeight / (previewHeight * crop.rect.height);

          width = previewWidth * previewScalar;
          height = previewHeight * previewScalar;
          var x = -crop.rect.x * previewWidth * previewScalar;
          var y = -crop.rect.y * previewHeight * previewScalar;

          // apply styles
          root.ref.clip.style.cssText =
            '\n                    width: ' +
            Math.round(clipWidth) +
            'px;\n                    height: ' +
            Math.round(clipHeight) +
            'px;\n                ';

          // position image
          previewImage.style.cssText =
            '\n                    ' +
            (transparencyIndicator !== null && transparencyIndicator !== 'grid'
              ? 'background-color: ' + transparencyIndicator + ';'
              : '') +
            '\n                    width: ' +
            Math.round(width) +
            'px;\n                    height: ' +
            Math.round(height) +
            'px;\n                    transform: translate(' +
            Math.round(x) +
            'px, ' +
            Math.round(y) +
            'px) rotateZ(0.00001deg);\n                ';
          root.ref.clip.appendChild(previewImage);

          // let others know of our fabulous achievement (so the image can be faded in)
          root.dispatch('DID_IMAGE_PREVIEW_DRAW', { id: id });
        }
      }),
      mixins: {
        styles: ['scaleX', 'scaleY', 'opacity'],
        animations: {
          scaleX: IMAGE_SCALE_SPRING_PROPS,
          scaleY: IMAGE_SCALE_SPRING_PROPS,
          opacity: { type: 'tween', duration: 750 }
        }
      }
    });
  };

  /**
   * Create gradient and mask definitions, we use these in each overlay so we can define them once
   * Turns out this also helps Safari to render the gradient on time
   */
  var definitions =
    "<radialGradient id=\"filepond--image-preview-radial-gradient\" cx=\".5\" cy=\"1.25\" r=\"1.15\">\n<stop offset='50%' stop-color='#000000'/>\n<stop offset='56%' stop-color='#0a0a0a'/>\n<stop offset='63%' stop-color='#262626'/>\n<stop offset='69%' stop-color='#4f4f4f'/>\n<stop offset='75%' stop-color='#808080'/>\n<stop offset='81%' stop-color='#b1b1b1'/>\n<stop offset='88%' stop-color='#dadada'/>\n<stop offset='94%' stop-color='#f6f6f6'/>\n<stop offset='100%' stop-color='#ffffff'/>\n</radialGradient>\n\n<mask id=\"filepond--image-preview-masking\">\n<rect x=\"0\" y=\"0\" width=\"500\" height=\"200\" fill=\"url(#filepond--image-preview-radial-gradient)\"></rect>\n</mask>";

  var appendDefinitions = function appendDefinitions() {
    if (document.readyState === 'interactive') {
      var defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      defs.style.cssText = 'position:absolute;width:0;height:0';
      defs.innerHTML = definitions;
      document.body.appendChild(defs);
    }
  };

  var hasNavigator = typeof navigator !== 'undefined';
  if (hasNavigator) {
    appendDefinitions();
    document.addEventListener('readystatechange', appendDefinitions);
  }

  // need to know if this is IE11 so we can render the definitions with each overlay
  var isEdgeOrIE = hasNavigator
    ? document.documentMode || /Edge/.test(navigator.userAgent)
    : false;

  var createImageOverlayView = function createImageOverlayView(fpAPI) {
    return fpAPI.utils.createView({
      name: 'image-preview-overlay',
      tag: 'div',
      ignoreRect: true,
      create: function create(_ref) {
        var root = _ref.root,
          props = _ref.props;

        root.element.classList.add(
          'filepond--image-preview-overlay-' + props.status
        );
        root.element.innerHTML =
          '<svg width="500" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">\n                ' +
          (isEdgeOrIE ? '<defs>' + definitions + '</defs>' : '') +
          '\n                <rect x="0" width="500" height="200" fill="currentColor" mask="url(#filepond--image-preview-masking)"></rect>\n            </svg>\n            ';
      },
      mixins: {
        styles: ['opacity'],
        animations: {
          opacity: { type: 'spring', mass: 25 }
        }
      }
    });
  };

  /**
   * Bitmap Worker
   */
  var BitmapWorker = function BitmapWorker() {
    // route messages
    self.onmessage = function(e) {
      toBitmap(e.data.message, function(response) {
        // imageBitmap is sent back as transferable
        self.postMessage({ id: e.data.id, message: response }, [response]);
      });
    };

    // resize image data
    var toBitmap = function toBitmap(options, cb) {
      fetch(options.file)
        .then(function(response) {
          return response.blob();
        })
        .then(function(blob) {
          return createImageBitmap(blob);
        })
        .then(function(imageBitmap) {
          return cb(imageBitmap);
        });
    };
  };

  var getImageSize = function getImageSize(url, cb) {
    var image = new Image();
    image.onload = function() {
      var width = image.naturalWidth;
      var height = image.naturalHeight;
      image = null;
      cb(width, height);
    };
    image.src = url;
  };

  var canCreateImageBitmap = function canCreateImageBitmap(file) {
    return 'createImageBitmap' in window && isBitmap(file);
  };

  var createImageWrapperView = function createImageWrapperView(_) {
    // create overlay view
    var overlay = createImageOverlayView(_);

    /**
     * Write handler for when preview container has been created
     */
    var didCreatePreviewContainer = function didCreatePreviewContainer(_ref) {
      var root = _ref.root,
        props = _ref.props;
      var utils = _.utils;
      var createWorker = utils.createWorker,
        loadImage = utils.loadImage;
      var id = props.id;

      // we need to get the file data to determine the eventual image size

      var item = root.query('GET_ITEM', id);

      // get url to file (we'll revoke it later on when done)
      var fileURL = URL.createObjectURL(item.file);

      // fallback
      var loadPreviewFallback = function loadPreviewFallback(
        item,
        width,
        height,
        orientation
      ) {
        // let's scale the image in the main thread :(
        loadImage(fileURL).then(previewImageLoaded);
      };

      // image is now ready
      var previewImageLoaded = function previewImageLoaded(data) {
        // the file url is no longer needed
        URL.revokeObjectURL(fileURL);

        // the preview is now ready to be drawn
        root.dispatch('DID_IMAGE_PREVIEW_LOAD', {
          id: id,
          data: data
        });
      };

      // determine image size of this item
      getImageSize(fileURL, function(width, height) {
        // we can now scale the panel to the final size
        root.dispatch('DID_IMAGE_PREVIEW_CALCULATE_SIZE', {
          id: id,
          width: width,
          height: height
        });

        // if we support scaling using createImageBitmap we use a worker
        if (canCreateImageBitmap(item.file)) {
          // let's scale the image in a worker
          var worker = createWorker(BitmapWorker);
          worker.post(
            {
              file: fileURL
            },
            function(imageBitmap) {
              // destroy worker
              worker.terminate();

              // no bitmap returned, must be something wrong,
              // try the oldschool way
              if (!imageBitmap) {
                loadPreviewFallback(item);
                return;
              }

              // yay we got our bitmap, let's continue showing the preview
              previewImageLoaded(imageBitmap);
            }
          );
        } else {
          // create fallback preview
          loadPreviewFallback(item);
        }
      });
    };

    /**
     * Write handler for when the preview has been loaded
     */
    var didLoadPreview = function didLoadPreview(_ref2) {
      var root = _ref2.root;

      root.ref.overlayShadow.opacity = 1;
    };

    /**
     * Write handler for when the preview image is ready to be animated
     */
    var didDrawPreview = function didDrawPreview(_ref3) {
      var root = _ref3.root;
      var image = root.ref.image;

      // reveal image

      image.scaleX = 1.0;
      image.scaleY = 1.0;
      image.opacity = 1;
    };

    /**
     * Write handler for when the preview has been loaded
     */
    var restoreOverlay = function restoreOverlay(_ref4) {
      var root = _ref4.root;

      root.ref.overlayShadow.opacity = 1;
      root.ref.overlayError.opacity = 0;
      root.ref.overlaySuccess.opacity = 0;
    };

    var didThrowError = function didThrowError(_ref5) {
      var root = _ref5.root;

      root.ref.overlayShadow.opacity = 0.25;
      root.ref.overlayError.opacity = 1;
    };

    var didCompleteProcessing = function didCompleteProcessing(_ref6) {
      var root = _ref6.root;

      root.ref.overlayShadow.opacity = 0.25;
      root.ref.overlaySuccess.opacity = 1;
    };

    /**
     * Constructor
     */
    var create = function create(_ref7) {
      var root = _ref7.root,
        props = _ref7.props;

      // image view
      var image = createImageView(_);

      // append image presenter
      root.ref.image = root.appendChildView(
        root.createChildView(image, {
          id: props.id,
          scaleX: 1.25,
          scaleY: 1.25,
          opacity: 0
        })
      );

      // image overlays
      root.ref.overlayShadow = root.appendChildView(
        root.createChildView(overlay, {
          opacity: 0,
          status: 'idle'
        })
      );

      root.ref.overlaySuccess = root.appendChildView(
        root.createChildView(overlay, {
          opacity: 0,
          status: 'success'
        })
      );

      root.ref.overlayError = root.appendChildView(
        root.createChildView(overlay, {
          opacity: 0,
          status: 'failure'
        })
      );
    };

    return _.utils.createView({
      name: 'image-preview-wrapper',
      create: create,
      write: _.utils.createRoute({
        // image preview stated
        DID_IMAGE_PREVIEW_LOAD: didLoadPreview,
        DID_IMAGE_PREVIEW_DRAW: didDrawPreview,
        DID_IMAGE_PREVIEW_CONTAINER_CREATE: didCreatePreviewContainer,

        // file states
        DID_THROW_ITEM_LOAD_ERROR: didThrowError,
        DID_THROW_ITEM_PROCESSING_ERROR: didThrowError,
        DID_THROW_ITEM_INVALID: didThrowError,
        DID_COMPLETE_ITEM_PROCESSING: didCompleteProcessing,
        DID_START_ITEM_PROCESSING: restoreOverlay,
        DID_REVERT_ITEM_PROCESSING: restoreOverlay
      })
    });
  };

  /**
   * Image Preview Plugin
   */
  var plugin$1 = function(fpAPI) {
    var addFilter = fpAPI.addFilter,
      utils = fpAPI.utils;
    var Type = utils.Type,
      createRoute = utils.createRoute,
      isFile = utils.isFile;

    // imagePreviewView

    var imagePreviewView = createImageWrapperView(fpAPI);

    // called for each view that is created right after the 'create' method
    addFilter('CREATE_VIEW', function(viewAPI) {
      // get reference to created view
      var is = viewAPI.is,
        view = viewAPI.view,
        query = viewAPI.query;

      // only hook up to item view and only if is enabled for this cropper

      if (!is('file') || !query('GET_ALLOW_IMAGE_PREVIEW')) {
        return;
      }

      // create the image preview plugin, but only do so if the item is an image
      var didLoadItem = function didLoadItem(_ref) {
        var root = _ref.root,
          props = _ref.props;
        var id = props.id;

        var item = query('GET_ITEM', id);

        // item could theoretically have been removed in the mean time
        if (!item || !isFile(item.file)) {
          return;
        }

        // get the file object
        var file = item.file;

        // exit if this is not an image
        if (!isPreviewableImage(file)) {
          return;
        }

        // exit if image size is too high and no createImageBitmap support
        // this would simply bring the browser to its knees and that is not what we want
        var supportsCreateImageBitmap = 'createImageBitmap' in (window || {});
        var maxPreviewFileSize = query('GET_IMAGE_PREVIEW_MAX_FILE_SIZE');
        if (
          !supportsCreateImageBitmap &&
          maxPreviewFileSize &&
          file.size > maxPreviewFileSize
        ) {
          return;
        }

        // set preview view
        root.ref.imagePreview = view.appendChildView(
          view.createChildView(imagePreviewView, { id: id })
        );

        // now ready
        root.dispatch('DID_IMAGE_PREVIEW_CONTAINER_CREATE', { id: id });
      };

      var didCalculatePreviewSize = function didCalculatePreviewSize(_ref2) {
        var root = _ref2.root,
          props = _ref2.props,
          action = _ref2.action;

        // get item
        var item = root.query('GET_ITEM', { id: props.id });

        // orientation info
        var exif = item.getMetadata('exif') || {};
        var orientation = exif.orientation || -1;

        // get width and height from action, and swap of orientation is incorrect
        var width = action.width,
          height = action.height;

        if (orientation >= 5 && orientation <= 8) {
          var _ref3 = [height, width];
          width = _ref3[0];
          height = _ref3[1];
        }

        // we need the item to get to the crop size
        var crop = item.getMetadata('crop') || {
          rect: {
            x: 0,
            y: 0,
            width: 1,
            height: 1
          },
          aspectRatio: height / width
        };

        // get height min and max
        var fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
        var minPreviewHeight = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
        var maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

        // scale up width and height when we're dealing with an SVG
        if (!isBitmap(item.file)) {
          var scalar = 2048 / width;
          width *= scalar;
          height *= scalar;
        }

        // const crop width
        height =
          fixedPreviewHeight !== null
            ? fixedPreviewHeight
            : Math.max(minPreviewHeight, Math.min(height, maxPreviewHeight));

        width = height / crop.aspectRatio;
        if (width > root.rect.element.width) {
          width = root.rect.element.width;
          height = width * crop.aspectRatio;
        }

        // set height
        root.ref.imagePreview.element.style.cssText =
          'height:' + Math.round(height) + 'px';
      };

      // start writing
      view.registerWriter(
        createRoute({
          DID_LOAD_ITEM: didLoadItem,
          DID_IMAGE_PREVIEW_CALCULATE_SIZE: didCalculatePreviewSize
        })
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

        // Style of the transparancy indicator used behind images
        imagePreviewTransparencyIndicator: [null, Type.STRING]
      }
    };
  };

  if (typeof navigator !== 'undefined' && document) {
    // plugin has loaded
    document.dispatchEvent(
      new CustomEvent('FilePond:pluginloaded', { detail: plugin$1 })
    );
  }

  return plugin$1;
});
