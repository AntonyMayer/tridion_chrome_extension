'use strict';

// nodemon --ignore 'tmp/tmp_.json'

class TridionRobotExtension {
    constructor() {
        this.server = null; //value will be updated based on data-tridion attr
        this.progress = {
            overlay: null,
            elementState: null,
            loader: null,
            counter: null,
            status: false,
            iteration: 0,
            loaded: 0
        };
        this.selectors = { //storage for class names
            tridion: '[data-tridion]', // selector for tridion elements to search => [data-tridion]
            btn: 'tridion__btn',
            info: 'tridion__info',
            overlay: 'tridion__overlay',
            overlayCopied: 'tridion__overlay--copied',
            overlayActive: 'tridion__overlay--active',
            overlaySendingData: 'tridion__overlay--sending',
            overlayNotification: 'tridion__overlay--notification',
            overlaySuccess: 'tridion__overlay--success',
            overlayFailure: 'tridion__overlay--failure',
            counter: 'tridion__counter',
            loader: 'tridion__loader',
            line: 'tridion__line',
            tmp: 'tridion__tmp' //this is id...
        };
        this.messages = {
            success: 'SUCCESS',
            failure: 'FAILED',
            copy: 'COPIED',
            button: 'T'
        }
        this.styleBtns();
    }

    /******************************************************************\
   < * MAJOR METHODS => prepare, post, send, semiManual mode, results * >
    \******************************************************************/

    /**
     * Send data to server
     * @param {object} node node element to be sent to server
     * @return {function} prepares data and send it to server;
     * @memberof TridionRobotExtension
     */
    sendData(node) {
        return _ => {
            this.progress.overlay = node.querySelector(`.${this.selectors.overlay}`);
            this.progress.loader = node.querySelector(`.${this.selectors.loader}`);
            this.progress.counter = node.querySelector(`.${this.selectors.counter}`);
            this.updateElementState(node, this.selectors.overlaySendingData);
            this.startOverlayTimer(node);
            this.prepareData(node).postData();
        }
    }

    /**
     * Prepare data before sending to server
     * @param {object} node element data to be sent to server
     * @return {object} self
     * @memberof TridionRobotExtension
     */
    prepareData(node) {
        let clearNode = node.cloneNode(true);

        //remove extension markup and classnames
        clearNode.getElementsByClassName(this.selectors.overlay)[0].remove();
        clearNode.classList.remove(this.selectors.overlaySendingData);
        clearNode.classList.remove(this.selectors.overlayActive);
        clearNode.classList.remove(this.selectors.overlayCopied);

        //update essential data
        this.server = `//localhost:3000/update-component/tcm:${clearNode.dataset.tridion}`;
        this.data = clearNode.outerHTML;

        return this;
    }

    /**
     * Send post request to server using fetch API
     * @return {void}
     * @memberof Tridion
     */
    postData() {
        let data = 'source=' + encodeURIComponent(this.data).replace(/(%20){2,}/g, "%20").replace(/(%09){1,}/g, "%20");

        fetch(this.server, {
            method: 'post',
            body: data,
            headers: new Headers({
                "content-type": "application/x-www-form-urlencoded",
                "cache-control": "no-cache"
            })
        }).then(response => {
            return response.json();
        }).then(data => {
            this.determineResults(data);
        });
    }

    /**
     * Automatically copy data and open appropriate tridion page, but manualy paste data
     * @param {object} node current element to be copied
     * @param {object} link actual link object to extract href
     * @return {void}
     * @memberof TridionRobotExtension
     */
    semiManualMode(node, link) {
        setTimeout(_=> { window.open(link.href) }, 1000);
        this.updateElementState(node, this.selectors.overlayCopied);
        this.prepareData(node);
        this.updateTmpData(this.data);
        this.copyToClipboard();
    }

    /**
     * Indicate the success or failure of automatic content post to tridion
     * @param {object} data custom response from server
     * @return {void} 
     * @memberof TridionRobotExtension
     */
    determineResults(data) {
        if (data.success) {
            this.progress.status = false;
            this.progress.counter.textContent = this.messages.success;
            this.updateElementState(this.progress.overlay, this.selectors.overlaySuccess);
        } else {
            this.progress.status = false;
            this.progress.counter.textContent = this.messages.failure;
            this.updateElementState(this.progress.overlay, this.selectors.overlayFailure);
        }
    }

    /*******************\
   < * DISPLAY METHODS * >
    \*******************/

    /**
     * Add UI to the page
     * @return {void}
     * @memberof TridionRobotExtension
     */
    displayAllBtns() {
        this.showTridionElements(this.findTridionElements());
    }

    /**
     * Remove UI from the page
     * @return {void}
     * @memberof TridionRobotExtension
     */
    hideAllBtns() {
        let btnElems = Array.from(document.querySelectorAll(`.${this.selectors.btn}`)),
            overlayElems = Array.from(document.querySelectorAll(`.${this.selectors.overlay}`)),
            tridions = Array.from(document.querySelectorAll(this.selectors.tridion)),
            allElems = [];

        allElems = btnElems.concat(overlayElems);

        for (let elm of allElems) {
            elm.remove();
        }
        for (let elm of tridions) {
            elm.classList.remove(this.selectors.overlaySendingData);
            elm.classList.remove(this.selectors.overlayCopied);
        }
    }

    /**
     * Combine all elements in one and add UI to each tridion element on the page
     * @param {object} data collection of elements that has [data-tridion] attribute 
     * @return {void}
     * @memberof TridionRobotExtension
     */
    showTridionElements(data) {
        //create one temporary textarea for copying data to clipboard 
        let tmp = document.createElement('textarea');

        tmp.id = this.selectors.tmp;
        document.body.appendChild(tmp);

        //create UI elements for each tridion element
        for (let elm of data) {
            let btn = this.createtBtn(),
                overlay = this.createtOverlay(),
                info = this.createInfoDiv();

            btn.onclick = this.sendData(elm);
            elm.onmouseover = _ => { return this.updateElementState(elm, this.selectors.overlayActive) };
            elm.onmouseout = _ => { return this.clearElementState(elm, this.selectors.overlayActive) };

            this.updateElementInfo(info, elm);

            overlay.appendChild(info);
            overlay.appendChild(btn);
            elm.appendChild(overlay);
        }
    }

    /*****************************\
   < * ELEMENTS CREATION METHODS * >
    \*****************************/

    /**
     * Create button for tridion element
     * @return {object}
     * @memberof TridionRobotExtension
     */
    createtBtn() {
            let btn = document.createElement('div');
            btn.textContent = this.messages.button;
            btn.className = this.selectors.btn;
            return btn;
        }

    /**
     * Create lines for overlay (decoration - borders)
     * @return {array} with 4 elements to be used as animated borders
     * @memberof TridionRobotExtension
     */
    createLines() {
        let lines = [];
        for (let i = 0; i < 4; i++) {
            let line = document.createElement('div');
            line.className = `${this.selectors.line} ${this.selectors.line}--${i}`;
            lines.push(line);
        }
        return lines;
    }

    /**
     * Create element with info for tridion element
     * @return {object}
     * @memberof TridionRobotExtension
     */
    createInfoDiv() {
        let info = document.createElement('div');
        info.className = this.selectors.info;
        return info;
    }

    /**
     * Create link element
     * @param {obj} id to be used for href attr and textContent
     * @return {object}
     * @memberof TridionRobotExtension
     */
    createLink(id) {
        let link = document.createElement('a');

        link.href = `http://www.epublishmerck.com/WebUI/item.aspx?tcm=16#id=tcm:${id}`;
        link.textContent = `COPY: ${id}`;
        link.target = `_blank`;

        return link;
    }

    /**
     * Create notification overlay
     * @param {string} text to be displayed on call
     * @returns {object}
     * @memberof TridionRobotExtension
     */
    createNotificationOverlay(text) {
        let note = document.createElement('div');

        note.className = this.selectors.overlayNotification;
        note.textContent = text;

        return note;
    }

    /**
     * Create container for tridion element and some extra elements, then combine them all
     * @return {object}
     * @memberof TridionRobotExtension
     */
    createtOverlay() {
        let overlay = document.createElement('div'),
            counter = document.createElement('div'),
            loader = document.createElement('div'),
            lines = this.createLines(),
            notification = this.createNotificationOverlay('COPIED');

        for (let line of lines) {
            overlay.appendChild(line);
        }

        overlay.className = this.selectors.overlay;
        counter.className = this.selectors.counter;
        loader.className = this.selectors.loader;

        overlay.appendChild(notification);
        overlay.appendChild(loader);
        overlay.appendChild(counter);

        return overlay;
    }

    /******************************\
   < * UPDATE STATUS/INFO METHODS * >
    \******************************/

    /**
     * Update hidden textarea value before copying it to clipboard
     * @param {string} data contains current element markup
     * @return {void}
     * @memberof TridionRobotExtension
     */
    updateTmpData(data) {
        document.getElementById(this.selectors.tmp).value = data;
    }
    
    /**
     * Add information about element to "info" div
     * @param {object} node info div 
     * @param {object} elm current element to extract data
     * @memberof TridionRobotExtension
     */
    updateElementInfo(node, elm) {
        let link = this.createLink(elm.dataset.tridion),
            name = elm.dataset.name || "Not sure",
            scope = elm.dataset.scope || "Who knows";

        node.innerHTML = `Name: ${name}<br>Scope: ${scope}<br>`;
        link.onclick = (e) => {
            e.preventDefault();
            return this.semiManualMode(elm, link);
        };
        node.appendChild(link);
    }

    /**
     * Update overlay state for element
     * @param {object} node element to be used with overlay
     * @param {string} state class modifier appnded to parent to set overlay state
     * @returns {void}
     * @memberof TridionRobotExtension
     */
    updateElementState(node, state) {
        node.classList.add(state);
        this.progress.overlayState = state;
    }

    /**
     * Hide overlay for element
     * @param {object} node element to be used with overlay  
     * @param {string} [state] if not indicated than 'this.progress.overlayState' will be used
     * @returns {void}
     * @memberof TridionRobotExtension
     */
    clearElementState(node, state) {
        node.classList.remove(state || this.progress.overlayState);
    }

    /*****************\
   < * FAKE TIMER =) * >
    \*****************/

    /**
     * Timer - call a callback then checks if this.progress.status is true and recursively calls itself
     * @param {function} callback function to be called on each iteration
     * @return {void}
     * @memberof TridionRobotExtension
     */
    timer(callback) {
        if (this.progress.status) {
            this.progress.iteration++;
            if (typeof callback === "function") callback();
            setTimeout(_ => { this.timer(callback); }, 200);
        } else callback(true);
    }

    /**
     * Start timer when data sending in progress
     * @param {object} node element to be used 
     * @return {void}
     * @memberof TridionRobotExtension
     */
    startOverlayTimer(node) {
        this.progress.status = true;
        this.timer(this.displayCounter.bind(this));
    }

    /**
     * Simulate loading bar
     * @param {boolean} done stops timer if true
     * @memberof TridionRobotExtension
     */
    displayCounter(done) {
        if (!done) {
            if (this.progress.iteration > 400) this.displayCounter(true); //if there's no answer from the server after 400 iterations emulate it
            if (this.progress.iteration < 75) this.progress.loaded += Math.random();
            else this.progress.loaded = (100 - 50 * (75 / this.progress.iteration));
            this.progress.loader.style.width = `${this.progress.loaded.toPrecision(4)}%`;
            this.progress.counter.textContent = `In Progress ${this.progress.loaded.toPrecision(4)}%`;
        } else {
            this.progress.loader.style.width = `100%`;
            this.progress.iteration = 0;
            this.progress.loaded = 0;
        }
    }

    /***************************\
   < * UTILITY/STYLING METHODS * >
    \***************************/

    /**
     * Search the page for tridion elements and update it's position attribute
     * @return {object} html collection
     * @memberof TridionRobotExtension
     */
    findTridionElements() {
        let tridions = document.querySelectorAll(this.selectors.tridion);

        for (let elm of tridions) { //check css position value not to break mark up
            let elmStyle = window.getComputedStyle(elm, null);
            if (elmStyle.position === `fixed`) continue;
            else elm.style.position = `relative`;
        }

        return tridions;
    }

    /**
     * Copy data from hidden textarea to system clipboard
     * @return {void}
     * @memberof TridionRobotExtension
     */
    copyToClipboard() {
        let data = document.getElementById(this.selectors.tmp).select();
        document.execCommand("copy");
    }

    /**
     * Add UI styles to page
     * @return {void}
     * @memberof TridionRobotExtension
     */
    styleBtns() {
        let sheet = document.styleSheets[0],
            rules = this.styles(),
            i = 0;

        for (let rule of rules) {
            sheet.insertRule(rule, i);
            i++;
        };
    }

    /**
     * Method returns an array of css rules for UI
     * @returns {array} 
     * @memberof TridionRobotExtension
     */
    styles() {
        return [
            //styles for buttons
            `.${this.selectors.btn} { 
                background: #f00;
                position:absolute;
                left:0px;
                top:0px;
                z-index:99;
                cursor:pointer;
                text-align:center;
                pointer-events:all;
                font-size:24px;
                line-height:1;
                padding:2px 6px;
                font-weight:900;
                color: #fff;
                transition: all .4s;
                z-index:200;
            }`,
            //disable button when sending data
            `.${this.selectors.overlaySendingData} .${this.selectors.btn} { 
                pointer-events: none; 
                opacity: 0;
            }`,
            //enable btn to resend data
            `.${this.selectors.overlayFailure} .${this.selectors.btn} { 
                pointer-events: all; 
                opacity: 1;     
                background: #400202;
                color: #fff;
                border-color: #fff;
            }`,
            //styles for overlay
            `.${this.selectors.overlay} {
                position:absolute;
                left:0;
                top:0;
                width:100%;
                height:100%;
                background: rgba(0,0,0,0);
                transition: all .4s;
                z-index:101;
                text-align: center;
                font-size: 30px;
                color: red;
                overflow: hidden;
            }`,
            //overlay active
            `.${this.selectors.overlayActive} .${this.selectors.overlay} { 
                background: rgba(0,0,0, .1);               
            }`,
            //overlay sending data
            `.${this.selectors.overlaySendingData} .${this.selectors.overlay},
             .${this.selectors.overlayCopied} .${this.selectors.overlay} { 
                background: rgba(0,0,0, .8); 
            }`,
            //overlay SUCCESS
            `.${this.selectors.overlaySendingData} .${this.selectors.overlaySuccess} { 
                background: rgba(0, 128, 0, .5);
            }`,
            //overlay FAILURE
            `.${this.selectors.overlaySendingData} .${this.selectors.overlayFailure} { 
                background: rgba(128, 0, 0, .5);
            }`,
            //loader
            `.${this.selectors.loader} { 
                width: 0;
                height: 5px;
                background: red;
                position: absolute;
                left: 0;
                bottom: 0; 
                transition: all .2s;
            }`,
            //loader SUCCESS
            `.${this.selectors.overlaySuccess} .${this.selectors.loader} { 
                background: green;
            }`,
            //counter
            `.${this.selectors.counter} { 
                display: block;
                color: #fff;
                font-size: 12px;
                position: absolute;
                left: 0;
                bottom: 5px; 
                padding: 5px;
            }`,
            //counter SUCCESS
            `.${this.selectors.overlaySuccess} .${this.selectors.counter} { 
                background: #024011;
                font-size: 20px;
                width: 100%;
                padding: 15px 25px;
                font-weight: 900;
                text-align: left;
            }`,
            //counter FAILURE
            `.${this.selectors.overlayFailure} .${this.selectors.counter} { 
                background: #400202;
                font-size: 20px;
                width: 100%;
                padding: 15px 25px;
                font-weight: 900;
                text-align: left;
            }`,
            //info 
            `.${this.selectors.info} { 
                font-size: 16px;
                padding: 15px 20px;
                color: #fff;
                text-align: right;
                opacity: 0;
                transition: all .4s;
                transform: translateY(-100%);
                background: rgba(0,0,0, 1);
            }`,
            //info active
            `.${this.selectors.overlayActive} .${this.selectors.info} { 
                opacity: 1;
                transform: translateY(0);
            }`,
            //info sending data
            `.${this.selectors.overlaySendingData} .${this.selectors.info},
             .${this.selectors.overlayCopied} .${this.selectors.info} {
                opacity: 1;
                transform: translateY(0);
                background: none;
            }`,
            //info link
            `.${this.selectors.info} a {
                display: inline-block;
                padding: 5px 15px;
                margin-top: 10px;
                background: #777;
                font-weight: bold;
                text-decoration: none;
                color: #fff;
                transition: all .4s;
            }`,
            //info link hover
            `.${this.selectors.info} a:hover {
                background: #fff;
                color: #777;
            }`,
            //lines
            `.${this.selectors.line} {
                position: absolute;
                left: 0;
                top: 0;
                width: 0;
                height: 2px;
                background: red;
                transition: all 1.5s;
                z-index: 10;
            }`,
            //lines active 
            `.${this.selectors.overlayActive} .${this.selectors.line} {
                transition: all .8s;
            }`,
            //line--1
            `.${this.selectors.line}--1 {
                height: 0;
                width: 2px;
            }`,
            //line--2
            `.${this.selectors.line}--2 {
                left: 100%;
                top: calc(100% - 2px);
            }`,
            //line--3
            `.${this.selectors.line}--3 {
                height: 0;
                width: 2px;
                top: 100%;
                left: calc(100% - 2px);
            }`,
            //lines active --0
            `.${this.selectors.overlayActive} .${this.selectors.line}--0 {
                width: 100%;
            }`,
            //lines active --1
            `.${this.selectors.overlayActive} .${this.selectors.line}--1 {
                height: 100%;
            }`,
            //lines active --2
            `.${this.selectors.overlayActive} .${this.selectors.line}--2 {
                left: 0;
                width: 100%;
            }`,
            //lines active --3
            `.${this.selectors.overlayActive} .${this.selectors.line}--3 {
                height: 100%;
                top: 0;
            }`,
            //notification overlay
            `.${this.selectors.overlayNotification} {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translateY(0%) translateX(-50%);
                font-size: 50px;
                font-weight: bold;
                color: #fff;
                opacity: 0;
                pointer-events: none;
                transition: all .7s;
            }`,
            //notification overlay active
            `.${this.selectors.overlayCopied} .${this.selectors.overlayNotification} {
                opacity: 1;
                transform: translateY(-50%) translateX(-50%);                
            }`,
            //temporary textarea
            `#${this.selectors.tmp} {
                position: fixed;
                pointer-events: none;
                opacity: 0;
                bottom: 0;
                left: 0;
            }`
        ]
    }
}