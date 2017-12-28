/*
 * FilePondPluginImagePreview 1.0.1
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
    // width and height have already been swapped earlier if orientation was in range below, let's swap back to make this code a bit more readable
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

    // data has been transferred to canvas
    if (data.close) {
      data.close();
    }

    return canvas;
  };

  var createImagePresenterView = function createImagePresenterView(fpAPI) {
    return fpAPI.utils.createView({
      name: 'image-preview',
      tag: 'canvas',
      create: function create(_ref) {
        var root = _ref.root;

        root.element.width = 0;
        root.element.height = 0;
      },
      write: fpAPI.utils.createRoute({
        DID_LOAD_PREVIEW_IMAGE: function DID_LOAD_PREVIEW_IMAGE(_ref2) {
          var root = _ref2.root,
            props = _ref2.props,
            action = _ref2.action;

          // set new root dimensions
          root.element.width = action.width;
          root.element.height = action.height;

          // draw preview to root
          var ctx = root.element.getContext('2d');
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
          setTimeout(function() {
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
  };

  var overlayTemplate = document.createElement('canvas');
  var overlayTemplateError = document.createElement('canvas');
  var overlayTemplateSuccess = document.createElement('canvas');

  var drawTemplate = function drawTemplate(canvas, colorFrom, colorTo) {
    var width = 500;
    var height = 200;

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
    grad.addColorStop(0.5, 'rgba(' + colorFrom.join(',') + ')');
    grad.addColorStop(1, 'rgba(' + colorTo.join(',') + ')');

    ctx.save();
    ctx.translate(-width * 0.25, 0);
    ctx.scale(1.5, 1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  var applyTemplate = function applyTemplate(source, target) {
    // copy width and height
    target.width = source.width;
    target.height = source.height;

    // draw the template
    var ctx = target.getContext('2d');
    ctx.drawImage(source, 0, 0);
  };

  drawTemplate(overlayTemplate, [40, 40, 40, 0], [40, 40, 40, 0.85]);
  drawTemplate(overlayTemplateError, [196, 78, 71, 0], [196, 78, 71, 1]);
  drawTemplate(overlayTemplateSuccess, [54, 151, 99, 0], [54, 151, 99, 1]);

  var createImageOverlayView = function createImageOverlayView(fpAPI) {
    return fpAPI.utils.createView({
      name: 'image-preview-overlay',
      tag: 'div',
      create: function create(_ref) {
        var root = _ref.root;

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
        self.postMessage({ id: e.data.id, message: response });
      });
    };

    // resize image data
    var toBitmap = function toBitmap(options, cb) {
      var file = options.file;

      /*
        const imageBitmapSettings = {
            resizeWidth,
            resizeHeight,
            resizeQuality: 'medium'
        }
        */

      // FileReader is required for Firefox, otherwise it throws an invalid state error on createImageBitmap

      var reader = new FileReader();
      reader.onload = function() {
        var blob = new Blob([new Uint8Array(reader.result)], {
          type: file.type
        });

        // we don't pass the imageBitmapSettings object, at the time of this writing it is still behind flags so it does nothing
        createImageBitmap(blob)
          .catch(function(error) {
            cb(null);
          })
          .then(function(imageBitmap) {
            cb(imageBitmap);
          });
      };
      reader.readAsArrayBuffer(file);
    };
  };

  var Marker = {
    JPEG: 0xffd8,
    APP1: 0xffe1,
    EXIF: 0x45786966,
    TIFF: 0x4949,
    Orientation: 0x0112,
    Unknown: 0xff00
  };

  var getUint16 = function getUint16(view, offset) {
    var little =
      arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    return view.getUint16(offset, little);
  };
  var getUint32 = function getUint32(view, offset) {
    var little =
      arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    return view.getUint32(offset, little);
  };

  var getImageOrientation = function getImageOrientation(file, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var view = new DataView(e.target.result);

      // Every JPEG file starts from binary value '0xFFD8'
      if (getUint16(view, 0) !== Marker.JPEG) {
        // This aint no JPEG
        cb(-1);
        return;
      }

      var length = view.byteLength;
      var offset = 2;

      while (offset < length) {
        var marker = getUint16(view, offset);
        offset += 2;

        // There's or APP1 Marker
        if (marker === Marker.APP1) {
          if (getUint32(view, (offset += 2)) !== Marker.EXIF) {
            // no EXIF info defined
            break;
          }

          // Get TIFF Header
          var little = getUint16(view, (offset += 6)) === Marker.TIFF;
          offset += getUint32(view, offset + 4, little);

          var tags = getUint16(view, offset, little);
          offset += 2;

          for (var i = 0; i < tags; i++) {
            // found the orientation tag
            if (
              getUint16(view, offset + i * 12, little) === Marker.Orientation
            ) {
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

  var createImagePreviewView = function createImagePreviewView(fpAPI) {
    var didCalculatePreviewSize = function didCalculatePreviewSize(_ref) {
      var root = _ref.root,
        props = _ref.props,
        action = _ref.action;

      // calculate scale ratio
      var scaleFactor = root.rect.element.width / action.width;

      // scale panel
      props.height = action.height * scaleFactor;
    };

    var didLoadPreview = function didLoadPreview(_ref2) {
      var root = _ref2.root;
      var overlay = root.ref.overlay;

      // reveal overlay

      overlay.opacity = 1;
    };

    var didDrawPreview = function didDrawPreview(_ref3) {
      var root = _ref3.root;
      var image = root.ref.image;

      // reveal image

      image.scaleX = 1.0;
      image.scaleY = 1.0;
      image.opacity = 1;
    };

    var create = function create(_ref4) {
      var root = _ref4.root,
        props = _ref4.props;
      var utils = fpAPI.utils;
      var createView = utils.createView,
        createWorker = utils.createWorker,
        loadImage = utils.loadImage;
      var id = props.id;

      // image view

      var image = createImagePresenterView(fpAPI);

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
      var overlay = createImageOverlayView(fpAPI);

      // append image overlay
      root.ref.overlay = root.appendChildView(
        root.createChildView(overlay, {
          opacity: 0
        })
      );

      // we need to get the file data to determine the eventual image size
      var item = root.query('GET_ITEM', id);

      // fallback
      var loadPreviewFallback = function loadPreviewFallback(
        item,
        width,
        height,
        orientation
      ) {
        // let's scale the image in the main thread :(
        loadImage(item.fileURL).then(function(image) {
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
        root.dispatch('DID_LOAD_PREVIEW_IMAGE', {
          id: id,
          data: data,
          width: width,
          height: height,
          orientation: orientation
        });
      };

      // we need to check the rotation of the image
      getImageOrientation(item.file, function(orientation) {
        // determine image size of this item
        getImageScaledSize(item.fileURL, 700, 700, function(width, height) {
          // if is rotated incorrectly swap width and height
          if (orientation >= 5 && orientation <= 8) {
            var _ref5 = [height, width];
            width = _ref5[0];
            height = _ref5[1];
          }

          // let writer know
          root.dispatch('DID_CALCULATE_PREVIEW_IMAGE_SIZE', {
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
                file: item.file,
                resizeWidth: width,
                resizeHeight: height
              },
              function(imageBitmap) {
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
      create: create,
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
  var plugin$1 = function(fpAPI) {
    var addFilter = fpAPI.addFilter,
      utils = fpAPI.utils;
    var Type = utils.Type,
      createRoute = utils.createRoute;

    var imagePreview = createImagePreviewView(fpAPI);

    // adds options to options register
    addFilter('SET_DEFAULT_OPTIONS', function(options) {
      return Object.assign(options, {
        // Enable or disable image preview
        allowImagePreview: [true, Type.BOOLEAN],

        // Max size of preview file for when createImageBitmap is not supported
        maxPreviewFileSize: [null, Type.INT]
      });
    });

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
        var supportsCreateImageBitmap = 'createImageBitmap' in (window || {});
        var maxPreviewFileSize = query('GET_MAX_PREVIEW_FILE_SIZE');
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

        // set preview view
        root.ref.imagePreview = view.appendChildView(
          view.createChildView(imagePreview, { id: id, height: 10 })
        );
      };

      var route = createRoute({
        DID_LOAD_ITEM: didLoadItem
      });

      var writer = function writer(_ref2) {
        var root = _ref2.root,
          props = _ref2.props,
          actions = _ref2.actions;

        route({ root: root, props: props, actions: actions });

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

  return plugin$1;
});
