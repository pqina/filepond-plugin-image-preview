/*
 * FilePondPluginImagePreview 1.0.3
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
    return /^image/.test(file.type) && !/svg/.test(file.type);
  };

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
    5: [0, 1, 1, 0, 0, 0],
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

    // data has been transferred to canvas ( if was ImageBitmap )
    if (data.close) {
      data.close();
    }

    // end draw image
    ctx.restore();

    return canvas;
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
      },
      write: fpAPI.utils.createRoute({
        DID_IMAGE_PREVIEW_LOAD: function DID_IMAGE_PREVIEW_LOAD(_ref2) {
          var root = _ref2.root,
            props = _ref2.props,
            action = _ref2.action;
          var id = props.id;

          // get item props

          var item = root.query('GET_ITEM', { id: props.id });
          var crop = item.getMetadata('crop') || {
            rect: {
              x: 0,
              y: 0,
              width: 1,
              height: 1
            },
            aspectRatio: action.height / action.width
          };

          // scale canvas based on pixel density
          var pixelDensityFactor = window.devicePixelRatio;

          // the max height of the preview container
          var containerMaxHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

          // calculate scaled preview image size
          var containerWidth = root.rect.inner.width;
          var previewImageRatio = action.height / action.width;
          var previewWidth = containerWidth;
          var previewHeight = containerWidth * previewImageRatio;

          // render scaled preview image
          var previewImage = createPreviewImage(
            action.data,
            previewWidth * pixelDensityFactor,
            previewHeight * pixelDensityFactor,
            action.orientation
          );

          // calculate crop container size
          var clipHeight = Math.min(previewHeight, containerMaxHeight);
          var clipWidth = clipHeight / crop.aspectRatio;

          // render image container that is fixed to crop ratio
          root.ref.clip.style.cssText =
            '\n                    width:' +
            clipWidth +
            'px;\n                    height:' +
            clipHeight +
            'px;\n                ';

          // calculate scalar based on if the clip rectangle has been scaled down
          var previewScalar = clipHeight / (previewHeight * crop.rect.height);

          var width = previewWidth * previewScalar;
          var height = previewHeight * previewScalar;
          var x = -crop.rect.x * previewWidth * previewScalar;
          var y = -crop.rect.y * previewHeight * previewScalar;

          previewImage.style.cssText =
            '\n                    width:' +
            width +
            'px;\n                    height:' +
            height +
            'px;\n                    transform:translate(' +
            Math.round(x) +
            'px, ' +
            Math.round(y) +
            'px);\n                ';
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

  var applyTemplate = function applyTemplate(source, target) {
    // copy width and height
    target.width = source.width;
    target.height = source.height;

    // draw the template
    var ctx = target.getContext('2d');
    ctx.drawImage(source, 0, 0);
  };

  var createImageOverlayView = function createImageOverlayView(fpAPI) {
    return fpAPI.utils.createView({
      name: 'image-preview-overlay',
      tag: 'canvas',
      ignoreRect: true,
      create: function create(_ref) {
        var root = _ref.root,
          props = _ref.props;

        applyTemplate(props.template, root.element);
      },
      mixins: {
        styles: ['opacity'],
        animations: {
          opacity: { type: 'spring', mass: 25 }
        }
      }
    });
  };

  var getImageSize = function getImageSize(url, cb) {
    var image = new Image();
    image.onload = function() {
      cb(image.naturalWidth, image.naturalHeight);
    };
    image.src = url;
  };

  var fitToBounds = function fitToBounds(
    width,
    height,
    boundsWidth,
    boundsHeight
  ) {
    var resizeFactor = Math.min(boundsWidth / width, boundsHeight / height);
    return {
      width: Math.round(width * resizeFactor),
      height: Math.round(height * resizeFactor)
    };
  };

  var getImageScaledSize = function getImageScaledSize(
    file,
    boundsWidth,
    boundsHeight,
    cb
  ) {
    getImageSize(file, function(naturalWidth, naturalHeight) {
      var size = fitToBounds(
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

  var easeInOutSine = function easeInOutSine(t) {
    return -0.5 * (Math.cos(Math.PI * t) - 1);
  };

  var addGradientSteps = function addGradientSteps(gradient, color) {
    var alpha =
      arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
    var easeFn =
      arguments.length > 3 && arguments[3] !== undefined
        ? arguments[3]
        : easeInOutSine;
    var steps =
      arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 10;
    var offset =
      arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 0;

    var range = 1 - offset;
    var rgb = color.join(',');
    for (var i = 0; i <= steps; i++) {
      var p = i / steps;
      var stop = offset + range * p;
      gradient.addColorStop(
        stop,
        'rgba(' + rgb + ', ' + easeFn(p) * alpha + ')'
      );
    }
  };

  var drawTemplate = function drawTemplate(
    canvas,
    width,
    height,
    color,
    alphaTarget
  ) {
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    var horizontalCenter = width * 0.5;

    var grad = ctx.createRadialGradient(
      horizontalCenter,
      height + 110,
      height - 100,
      horizontalCenter,
      height + 110,
      height + 100
    );

    addGradientSteps(grad, color, alphaTarget, undefined, 8, 0.4);

    ctx.save();
    ctx.translate(-width * 0.5, 0);
    ctx.scale(2, 1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  var width = 500;
  var height = 200;

  var overlayTemplateShadow = document.createElement('canvas');
  var overlayTemplateError = document.createElement('canvas');
  var overlayTemplateSuccess = document.createElement('canvas');

  drawTemplate(overlayTemplateShadow, width, height, [40, 40, 40], 0.85);
  drawTemplate(overlayTemplateError, width, height, [196, 78, 71], 1);
  drawTemplate(overlayTemplateSuccess, width, height, [54, 151, 99], 1);

  var createImageWrapperView = function createImageWrapperView(fpAPI) {
    // create overlay view
    var overlay = createImageOverlayView(fpAPI);

    /**
     * Write handler for when preview container has been created
     */
    var didCreatePreviewContainer = function didCreatePreviewContainer(_ref) {
      var root = _ref.root,
        props = _ref.props;
      var utils = fpAPI.utils;
      var createView = utils.createView,
        createWorker = utils.createWorker,
        loadImage = utils.loadImage;
      var id = props.id;

      // we need to get the file data to determine the eventual image size

      var item = root.query('GET_ITEM', id);

      // get url to file (we'll revoke it later on when done)
      var fileURL = URL.createObjectURL(item.file);

      // orientation info
      var exif = item.getMetadata('exif') || {};
      var orientation = exif.orientation || -1;

      // fallback
      var loadPreviewFallback = function loadPreviewFallback(
        item,
        width,
        height,
        orientation
      ) {
        // let's scale the image in the main thread :(
        loadImage(fileURL).then(function(image) {
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);
          previewImageLoaded(canvas, width, height, orientation);
        });
      };

      // image is now ready
      var previewImageLoaded = function previewImageLoaded(
        data,
        width,
        height,
        orientation
      ) {
        // the file url is no longer needed
        URL.revokeObjectURL(fileURL);

        root.dispatch('DID_IMAGE_PREVIEW_LOAD', {
          id: id,
          data: data,
          width: width,
          height: height,
          orientation: orientation
        });
      };

      // determine max size
      var boundsX = root.rect.element.width * window.devicePixelRatio * 2;
      var boundsY = boundsX;

      // determine image size of this item
      getImageScaledSize(fileURL, boundsX, boundsY, function(width, height) {
        // if is rotated incorrectly swap width and height
        // this makes sure the container dimensions ar rendered correctly
        if (orientation >= 5 && orientation <= 8) {
          var _ref2 = [height, width];
          width = _ref2[0];
          height = _ref2[1];
        }

        // we can now scale the panel to the final size
        root.dispatch('DID_IMAGE_PREVIEW_CALCULATE_SIZE', {
          id: id,
          width: width,
          height: height
        });

        // if we support scaling using createImageBitmap we use a worker
        if ('createImageBitmap' in window) {
          // let's scale the image in a worker
          var worker = createWorker(BitmapWorker);
          worker.post(
            {
              file: fileURL
            },
            function(imageBitmap) {
              // no bitmap returned, must be something wrong,
              // try the oldschool way
              if (!imageBitmap) {
                loadPreviewFallback(item, width, height, orientation);
                return;
              }

              // yay we got our bitmap, let's continue showing the preview
              previewImageLoaded(imageBitmap, width, height, orientation);

              // destroy worker
              worker.terminate();
            }
          );
        } else {
          // create fallback preview
          loadPreviewFallback(item, width, height, orientation);
        }
      });
    };

    /**
     * Write handler for when the preview has been loaded
     */
    var didLoadPreview = function didLoadPreview(_ref3) {
      var root = _ref3.root;

      root.ref.overlayShadow.opacity = 1;
    };

    /**
     * Write handler for when the preview image is ready to be animated
     */
    var didDrawPreview = function didDrawPreview(_ref4) {
      var root = _ref4.root;
      var image = root.ref.image;

      // reveal image

      image.scaleX = 1.0;
      image.scaleY = 1.0;
      image.opacity = 1;
    };

    /**
     * Write handler for when the preview has been loaded
     */
    var restoreOverlay = function restoreOverlay(_ref5) {
      var root = _ref5.root;

      root.ref.overlayShadow.opacity = 1;
      root.ref.overlayError.opacity = 0;
      root.ref.overlaySuccess.opacity = 0;
    };

    var didThrowError = function didThrowError(_ref6) {
      var root = _ref6.root;

      root.ref.overlayShadow.opacity = 0.25;
      root.ref.overlayError.opacity = 1;
    };

    var didCompleteProcessing = function didCompleteProcessing(_ref7) {
      var root = _ref7.root;

      root.ref.overlayShadow.opacity = 0.25;
      root.ref.overlaySuccess.opacity = 1;
    };

    /**
     * Constructor
     */
    var create = function create(_ref8) {
      var root = _ref8.root,
        props = _ref8.props;
      var id = props.id;

      // image view

      var image = createImageView(fpAPI);

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
          template: overlayTemplateShadow,
          opacity: 0
        })
      );

      root.ref.overlaySuccess = root.appendChildView(
        root.createChildView(overlay, {
          template: overlayTemplateSuccess,
          opacity: 0
        })
      );

      root.ref.overlayError = root.appendChildView(
        root.createChildView(overlay, {
          template: overlayTemplateError,
          opacity: 0
        })
      );

      // done creating the container, now wait for write so we can use the container element width for our image preview
      root.dispatch('DID_IMAGE_PREVIEW_CONTAINER_CREATE', { id: id });
    };

    return fpAPI.utils.createView({
      name: 'image-preview-wrapper',
      create: create,
      write: fpAPI.utils.createRoute({
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
      createRoute = utils.createRoute;

    var imagePreview = createImageWrapperView(fpAPI);

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
        if (!item) {
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

        // set panel
        var panel = fpAPI.views.panel;

        root.ref.panel = view.appendChildView(view.createChildView(panel));
        root.ref.panel.element.classList.add('filepond--panel-item');

        // set offset height so panel starts small and scales up when the image loads
        root.ref.panel.height = 10;

        // set preview view
        root.ref.imagePreview = view.appendChildView(
          view.createChildView(imagePreview, { id: id })
        );
      };

      var didCalculatePreviewSize = function didCalculatePreviewSize(_ref2) {
        var root = _ref2.root,
          props = _ref2.props,
          action = _ref2.action;

        // maximum height
        var maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

        // calculate scale ratio
        var scaleFactor = root.rect.element.width / action.width;

        // final height
        var height = Math.min(maxPreviewHeight, action.height * scaleFactor);

        // set height
        root.ref.imagePreview.element.style.cssText = 'height:' + height + 'px';

        // set new panel height
        root.ref.panel.height = height;
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

        // Max image height
        imagePreviewMaxHeight: [256, Type.INT],

        // Max size of preview file for when createImageBitmap is not supported
        imagePreviewMaxFileSize: [null, Type.INT]
      }
    };
  };

  if (document) {
    // plugin has loaded
    document.dispatchEvent(
      new CustomEvent('FilePond:pluginloaded', { detail: plugin$1 })
    );
  }

  return plugin$1;
});
