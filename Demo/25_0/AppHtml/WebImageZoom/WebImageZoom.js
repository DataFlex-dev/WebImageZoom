/*
Class:
    df.WebImageZoom
Extends:
    df.WebImage

An extended version of the WebImage that allows for zooming certain images
    
Revision:
    2017/08/30  (Henri Reterink, DAE)
        Initial version.
*/

var wizFit = 0;
var wizCoverWidth = 1;
var wizCoverHeight = 2;
var wizCoverSmart = 3;


df.WebImageZoom = class WebImageZoom extends df.WebBaseControl {
    constructor(sName, oParent) {
        super(sName, oParent);

        this.prop(df.tString, "psUrl", "");
        this.prop(df.tBool, "pbShowBorder", false);
        this.prop(df.tInt, "peImageFit", 0);
        this.prop(df.tNumber, "pnMinZoom", 0.1);
        this.prop(df.tNumber, "pnMaxZoom", 10);

        this.prop(df.tBool, "pbAllowTouchMove", true);
        this.prop(df.tBool, "pbAllowTouchZoom", true);
        this.prop(df.tBool, "pbAllowMouseMove", true);
        this.prop(df.tBool, "pbAllowMouseZoom", true);

        // @privates
        this._eCanvas = null; // Canvas html element
        this._oCanvas = null; // ImgCanvas object

        this._bFocusAble = false;
        this._sControlClass = "WebImageZoom";
    }

    /*
    This method augments the html generation and adds the div.WebImg_Wrp element and the canvas element.

    @param  aHtml   String builder array containing html.

    @private
    */
    openHtml(aHtml) {
        super.openHtml(aHtml);

        aHtml.push('<div class="WebImg_Wrp"><canvas class="WebImgZoom_Canvas" style="width: 100%; height: 100%"></canvas>');
    }

    /*
    This method augments the html generation and closes the div.WebImg_Wrp element.
    
    @param  aHtml   String builder array containing html.
    
    @private
    */
    closeHtml(aHtml) {
        aHtml.push('</div>');

        super.closeHtml(aHtml);
    }

    /*
    This method is called after rendering and is used the get references to DOM elements, attach event 
    listeners and do other initialization.
    
    @private
    */
    afterRender() {
        this._eControl = df.dom.query(this._eElem, "div.WebImg_Wrp");
        this._eCanvas = df.dom.query(this._eElem, '.WebImgZoom_Canvas');

        super.afterRender();

        this.set_pbShowBorder(this.pbShowBorder);
        this.set_piHeight(this.piHeight);
        this.updateImage();
    }

    updateImage() {
        // We have to create a new canvas every time we load an image due to possible differences in size
        this._oCanvas = new df.ImgCanvas({
            canvas: this._eCanvas,
            path: this.psUrl,
            bAllowMouseMove: this.pbAllowMouseMove,
            bAllowMouseZoom: this.pbAllowMouseZoom,
            bAllowTouchMove: this.pbAllowTouchMove,
            bAllowTouchZoom: this.pbAllowTouchZoom,
            eFitMode: this.peImageFit,
            nMinZoom: this.pnMinZoom,
            nMaxZoom: this.pnMaxZoom
        });
    }

    resize() {
        this.updateImage();
    }

    /*
    This method determines if the image is shown with a border and background. It does this by removing 
    or adding the "WebImg_Box" CSS class.
    
    @param  bVal    The new value.
    */
    set_pbShowBorder(bVal) {
        if (this._eControl) {
            df.dom.toggleClass(this._eControl, "WebImg_Box", bVal);

            if (this.pbShowBorder !== bVal) {
                this.sizeChanged();
            }
        }
    }

    /*
    Sets the tooltip on the image element. Both the alt and the title attributes are set to make it show 
    as a tooltip in all browser.
    
    @param  sVal    The new tooltip.
    */
    set_psToolTip(sVal) {
        if (this._eCanvas) {
            this._eCanvas.alt = sVal;
            this._eCanvas.title = sVal;
        }
    }

    set_psUrl(sVal) {
        this.psUrl = sVal;

        this.updateImage();
    }

    // WebSetting these values will cause a full redraw of the canvas and image, use sparingly.
    set_pbAllowMouseMove(bVal) {
        this.pbAllowMouseMove = bVal;

        this.updateImage();
    }

    set_pbAllowMouseZoom(bVal) {
        this.pbAllowMouseZoom = bVal;

        this.updateImage();
    }

    set_pbAllowTouchMove(bVal) {
        this.pbAllowTouchMove = bVal;

        this.updateImage();
    }

    set_pbAllowTouchZoom(bVal) {
        this.pbAllowTouchZoom = bVal;

        this.updateImage();
    }

    set_pnMinZoom(nVal) {
        this.pnMinZoom = nVal

        this.updateImage();
    }

    set_pnMaxZoom(nVal) {
        this.pnMaxZoom = nVal

        this.updateImage();
    }


};

df.ImgCanvas = class ImgCanvas {
    constructor(options) {
        if (!options || !options.canvas || !options.path) {
            console.log('ImgCanvas constructor: missing arguments canvas or path');
        } else {

            this.canvas = options.canvas;
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            this.context = this.canvas.getContext('2d');
            this.eFitMode = options.eFitMode || 0;
            this.nMinZoom = ((parseFloat(options.nMinZoom) > 0) ? parseFloat(options.nMinZoom) : 0.1);
            this.nMaxZoom = ((parseFloat(options.nMaxZoom) > 0) ? parseFloat(options.nMaxZoom) : 10);

            this.position = {
                x: 0,
                y: 0
            };
            this.scale = {
                x: 0.5,
                y: 0.5
            };
            this.imgTexture = new Image();
            this.imgTexture.src = options.path;

            this.iImgWidth = 0;
            this.iImgHeight = 0;

            this.iLastZoomScale = null;
            this.iLastX = null;
            this.iLastY = null;
            this.bTapped = false; // Double tap event
            this.mdown = false; // Mouse down

            this.iOrigScale = null;

            this.bInit = false;
            this.checkRequestAnimationFrame();
            requestAnimationFrame(this.animate.bind(this));

            this.bAllowTouchMove = options.bAllowTouchMove;
            this.bAllowTouchZoom = options.bAllowTouchZoom;
            this.bAllowMouseMove = options.bAllowMouseMove;
            this.bAllowMouseZoom = options.bAllowMouseZoom;
            this.setEventListeners();
        }
    }
    animate() {
        //set scale such as image cover all the canvas
        if (!this.bInit) {
            if (this.imgTexture.width) {
                var scaleRatio = null;
                var scaleWidth = null;
                var scaleHeight = null;
                if (this.eFitMode == wizCoverWidth || (this.eFitMode == wizCoverSmart && this.canvas.clientWidth > this.canvas.clientHeight)) {
                    scaleRatio = this.canvas.clientWidth / this.imgTexture.width;
                }
                else if (this.eFitMode == wizCoverHeight || (this.eFitMode == wizCoverSmart && this.canvas.clientHeight > this.canvas.clientWidth)) {
                    scaleRatio = this.canvas.clientHeight / this.imgTexture.height;
                }
                else if (this.eFitMode == wizFit) {
                    // Fit to the smallest ratio, resize the canvas to fit
                    scaleWidth = this.canvas.clientWidth / this.imgTexture.width;
                    scaleHeight = this.canvas.clientHeight / this.imgTexture.height;
                    scaleRatio = (scaleWidth < scaleHeight ? scaleWidth : scaleHeight);
                }

                this.scale.x = scaleRatio;
                this.scale.y = scaleRatio;

                this.iImgWidth = (this.imgTexture.width * this.scale.x);
                this.iImgHeight = (this.imgTexture.height * this.scale.y);

                // initial values
                this.iOrigScale = scaleRatio;
                this.iOrigX = this.position.x;
                this.iOrigY = this.position.y;
                this.iOrigImgWidth = this.iImgWidth;
                this.iOrigImgHeight = this.iImgHeight;

                this.bInit = true;
            }
        }

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.context.drawImage(
            this.imgTexture,
            this.position.x, this.position.y,
            this.scale.x * this.imgTexture.width,
            this.scale.y * this.imgTexture.height);

        requestAnimationFrame(this.animate.bind(this));
    }
    resetZoom() {
        this.scale.x = this.iOrigScale;
        this.scale.y = this.iOrigScale;
        this.position.x = this.iOrigX;
        this.position.y = this.iOrigY;
        this.iImgWidth = this.iOrigImgWidth;
        this.iImgHeight = this.iOrigImgHeight;
    }
    handleMouseZoom(e) {
        var e = window.event || e; // old IE support
        var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

        this.doZoom(delta);
    }
    gesturePinchZoom(event) {
        var zoom = false;

        if (event.targetTouches.length >= 2) {
            var p1 = event.targetTouches[0];
            var p2 = event.targetTouches[1];
            var zoomScale = Math.sqrt(Math.pow(p2.pageX - p1.pageX, 2) + Math.pow(p2.pageY - p1.pageY, 2)); //euclidian distance

            if (this.iLastZoomScale) {
                zoom = zoomScale - this.iLastZoomScale;
            }

            this.iLastZoomScale = zoomScale;
        }

        return zoom;
    }
    doZoom(zoom) {
        if (!zoom) return;

        //new scale
        var currentScale = this.scale.x;
        var newScale = this.scale.x + zoom / 100;

        if (newScale > this.nMinZoom && newScale < this.nMaxZoom) { // Prevent endless zooming in or out
            //some helpers
            var deltaScale = newScale - currentScale;
            var currentWidth = (this.imgTexture.width * this.scale.x);
            var currentHeight = (this.imgTexture.height * this.scale.y);
            var deltaWidth = this.imgTexture.width * deltaScale;
            var deltaHeight = this.imgTexture.height * deltaScale;


            //by default scale doesnt change position and only add/remove pixel to right and bottom
            //so we must move the image to the left to keep the image centered
            //ex: coefX and coefY = 0.5 when image is centered <=> move image to the left 0.5x pixels added to the right
            var canvasmiddleX = this.canvas.clientWidth / 2;
            var canvasmiddleY = this.canvas.clientHeight / 2;
            var xonmap = (-this.position.x) + canvasmiddleX;
            var yonmap = (-this.position.y) + canvasmiddleY;
            var coefX = -xonmap / (currentWidth);
            var coefY = -yonmap / (currentHeight);
            var newPosX = this.position.x + deltaWidth * coefX;
            var newPosY = this.position.y + deltaHeight * coefY;

            //edges cases
            var newWidth = currentWidth + deltaWidth;
            var newHeight = currentHeight + deltaHeight;

            if (newWidth < this.canvas.clientWidth) { newPosX = 0; } // While the image is smaller than the canvas, always start from the origin (0,0)
            if (newPosX > 0) { newPosX = 0; } // Make sure we dont draw outside the canvas..

            if (newHeight < this.canvas.clientHeight) { newPosY = 0; } // While the image is smaller than the canvas, always start from the origin (0,0)
            if (newPosY > 0) { newPosY = 0; } // Make sure we dont draw outside the canvas..



            //finally affectations
            this.scale.x = newScale;
            this.scale.y = newScale;
            this.position.x = newPosX;
            this.position.y = newPosY;
            this.iImgWidth = newWidth;
            this.iImgHeight = newHeight;
        }
    }
    doMove(iRelX, iRelY) {
        if (this.iLastX && this.iLastY) {
            var iDeltaX = iRelX - this.iLastX;
            var iDeltaY = iRelY - this.iLastY;
            var currentWidth = (this.imgTexture.width * this.scale.x);
            var currentHeight = (this.imgTexture.height * this.scale.y);




            // TODO: do not allow moving along X if canvas width > image width - same goes for Y
            //edge cases
            if (this.canvas.clientWidth < this.iImgWidth) {
                this.position.x += iDeltaX;

                if (this.position.x > 0) {
                    this.position.x = 0;
                } else if (this.position.x + currentWidth < this.canvas.clientWidth) {
                    this.position.x = this.canvas.clientWidth - currentWidth;
                }

            }
            if (this.canvas.clientHeight < this.iImgHeight) {
                this.position.y += iDeltaY;

                if (this.position.y > 0) {
                    this.position.y = 0;
                } else if (this.position.y + currentHeight < this.canvas.clientHeight) {
                    this.position.y = this.canvas.clientHeight - currentHeight;
                }

            }

        }

        this.iLastX = iRelX;
        this.iLastY = iRelY;
    }
    setEventListeners() {
        // Touch handlers
        if (this.bAllowTouchZoom || this.bAllowTouchMove) {
            this.canvas.addEventListener('touchstart', function (e) {
                e.preventDefault();

                this.iLastX = null;
                this.iLastY = null;
                this.iLastZoomScale = null;

                // Single tap
                if (!this.bTapped) {
                    this.bTapped = true;
                    var that = this;
                    setTimeout(function () {
                        that.bTapped = false;
                    }, 300);
                } else {
                    // Double tap
                    if (e.targetTouches.length == 1) {
                        this.resetZoom();
                        this.bTapped = false;
                    }
                }
            }.bind(this));

            this.canvas.addEventListener('touchmove', function (e) {
                e.preventDefault();

                // 2 fingers = zoom
                if (e.targetTouches.length == 2 && this.bAllowTouchZoom) { //pinch
                    this.doZoom(this.gesturePinchZoom(e));
                }

                // 1 Finger = move
                else if (e.targetTouches.length == 1 && this.bAllowTouchMove) {
                    var iRelX = e.targetTouches[0].pageX - this.canvas.getBoundingClientRect().left;
                    var iRelY = e.targetTouches[0].pageY - this.canvas.getBoundingClientRect().top;
                    this.doMove(iRelX, iRelY);
                }
            }.bind(this));
        }

        // Mouse scroll zoom handler
        if (this.bAllowMouseZoom) {
            this.canvas.addEventListener('mousewheel', this.handleMouseZoom.bind(this));
            // FireFox
            this.canvas.addEventListener('DOMMouseScroll', this.handleMouseZoom.bind(this));
        }
        // Mouse move handlers
        if (this.bAllowMouseMove) {
            window.addEventListener('mousedown', function (e) {
                this.mdown = true;
                this.iLastX = null;
                this.iLastY = null;
            }.bind(this));

            window.addEventListener('mouseup', function (e) {
                this.mdown = false;

                // Single click
                if (!this.bTapped) {
                    this.bTapped = true;
                    var that = this;
                    setTimeout(function () {
                        that.bTapped = false;
                    }, 300);
                } else {
                    // Double click
                    this.resetZoom();
                    this.bTapped = false;
                }
            }.bind(this));
            // Mouse move handler
            window.addEventListener('mousemove', function (e) {
                var iRelX = e.pageX - this.canvas.getBoundingClientRect().left;
                var iRelY = e.pageY - this.canvas.getBoundingClientRect().top;

                if (e.target == this.canvas && this.mdown) {
                    this.doMove(iRelX, iRelY);
                }

                if (iRelX <= 0 || iRelX >= this.canvas.clientWidth || iRelY <= 0 || iRelY >= this.canvas.clientHeight) {
                    this.mdown = false;
                }
            }.bind(this));
        }
    }
    // Create AnimationFrame methods if they do not exist in the browsers..
    checkRequestAnimationFrame() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
            window.cancelAnimationFrame =
                window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function (callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function () { callback(currTime + timeToCall); }
                    , timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
        }

        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = function (id) {
                clearTimeout(id);
            };
        }
    }
};