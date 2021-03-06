const XULNS   = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'; 
const XHTMLNS = 'http://www.w3.org/1999/xhtml';
 
var Presentation = { 
	 
	baseSize        : 9, 

	phraseOpenParen  : '[',
	phraseCloseParen : ']',
	makePhraseRegExp : function(aPattern, aFlags)
	{
		return new RegExp(
				aPattern.replace(/%o(pen)?/gi, '\\'+this.phraseOpenParen)
					.replace(/%c(lose)?/gi, '\\'+this.phraseCloseParen),
				aFlags
			);
	},

	dragStartDelta : 8,

	imageType : 'jpeg',

	EDIT_BOX_ID_PREFIX : 'editPageBox-',
 
	initialized : false, 

	preventToShowHideToolbar : false,

	loadingTimeout           : 10000,
	showMontaKeywordDuration : 100,
	autoCruiseInterval       : 2000,
	timerUpdatingInterval    : 30000,

	cachedContents : [],
	sourceData     : [],
	_alias         : {},

	noteWindow : null,
 
	init : function(option){ 
		if (this.initialized) {
			this.startPresentation();
			return;
		}
		this.initialized = true;


		this._offset  = 0;
		this.canvas     = document.getElementById('canvas');
		this.canvasMain = document.getElementById('canvasMain');
		this.content    = document.getElementById('content');
		this.header     = document.getElementById('header');
		this.footer     = document.getElementById('footer');
		this.logo       = document.getElementById('logo');
		this.next       = document.getElementById('nextPage');

		this.indicatorBar = document.getElementById('indicatorBar');
		this.remainder    = document.getElementById('remainingPageIndicator');
		this.timer        = document.getElementById('remainingTimeIndicator');

		this.list     = document.getElementById('pages-list');
		this.source   = document.getElementById('sourceEditField');
		this.pages    = document.getElementById('pageEditFields');
		this.deck     = document.getElementById('deck');
		this.scroller = document.getElementById('scroller');
		this.noteButtonBox = document.getElementById('noteButtonBox');
		this.noteButton = document.getElementById('noteButton');

		this.toolbar         = document.getElementById('canvasToolbar');
		this.toolbarHeight   = this.toolbar.boxObject.height;
		this.isToolbarHidden = true;
		this.toolbar.setAttribute('style', 'margin-top:'+(0-this.toolbarHeight)+'px;margin-bottom:0px;');

		window.addEventListener('resize', this, false);
		window.addEventListener('contextmenu', this, false);
		window.addEventListener('unload', this, false);

		this.canvasMain.addEventListener('DOMMouseScroll', this, false);
		this.indicatorBar.addEventListener('DOMMouseScroll', this, false);

		if(option){
			for(var i in option){this[i] = option[i]}
		}

		this.cachedContents = [];

		if (this.readParameter()) {
			this.startPresentation();
		}

		document.documentElement.focus();
	},
	get canvasWidth()
	{
		return window.innerWidth;
	},
	get canvasHeight()
	{
		return window.innerHeight - this.indicatorBar.boxObject.height;
	},
 
/* core */ 
	
	startPresentation : function(aStart) 
	{
		if (this.data.length)
			document.title = this.data[0].title || this.data[0].header || this.data[0].text.join(' ');

		var now = Date.now();
		if (aStart === void(0)) aStart = now;

		if (this.ready || now - aStart >= this.loadingTimeout)
			this.takahashi();
		else
			window.setTimeout(function(aSelf) {
				aSelf.startPresentation(aStart);
			}, 100, this);
	},
	get ready()
	{
		for (var i in this.images)
		{
			if (!this.images[i].loaded)
				return false;
		}
		return true;
	},
 
/* rendering */ 
	
	takahashi : function() { 
		this.isRendering = true;

		if (!this.data[this.offset]) {
			this.offset = this.data.length-1;
		}
		document.getElementById("current_page").value = this.offset+1;
		document.getElementById("max_page").value     = this.data.length;

		this.scroller.setAttribute('maxpos', this.data.length-1);
		this.scroller.setAttribute('curpos', this.offset);

		var broadcaster = document.getElementById('canBack');
		if (!this.offset)
			broadcaster.setAttribute('disabled', true);
		else
			broadcaster.removeAttribute('disabled');

		var broadcaster = document.getElementById('canForward');
		if (this.offset == this.data.length-1)
			broadcaster.setAttribute('disabled', true);
		else
			broadcaster.removeAttribute('disabled');

		this.canvas.setAttribute('rendering', true);


		this.header.removeAttribute('style');
		this.footer.removeAttribute('style');
		this.content.removeAttribute('style');

		this.clickableNodes = [];

		if ('title' in this.data[this.offset])
			document.title = this.data[this.offset].title;

		this.header.setAttribute('style', 'font-size:10px;');
		this.header.value = this.data[this.offset].header;
		this.footer.setAttribute('style', 'font-size:10px;');
		this.footer.value = this.data[this.offset].footer;

		var page = this.content.getAttribute('page') || 0;
		var currentContent = this.clearContent();
		if (!(page in this.cachedContents)) {
			this.cachedContents[page] = !this.content.hasChildNodes() ? null : {
				fragment     : currentContent,
				offsetWidth  : parseInt(this.content.getAttribute('offsetWidth')),
				offsetHeight : parseInt(this.content.getAttribute('offsetHeight'))
			};
		}

		if (this.data[this.offset].load) {
			this.isRendering = false;
			location.replace(location.href.split('?')[0] + '?data='+this.data[this.offset].load);
			return;
		}

		var content = (this.offset in this.cachedContents && this.cachedContents[this.offset]) ?
							this.cachedContents[this.offset] :
							this.createContent();

		this.content.setAttribute('style', 'font-size:10px;');
		this.content.setAttribute('page',         this.offset);
		this.content.setAttribute('offsetWidth',  content.offsetWidth);
		this.content.setAttribute('offsetHeight', content.offsetHeight);

		this.content.appendChild(content.fragment);

		this.clickableNodes.push(this.content);


		this.fitHeaderFooterToCanvas();
		this.fitMainContentToCanvas();


		try {
			let checkedItems = this.list.getElementsByAttribute('checked', 'true');
			max = checkedItems.length;
			for (i = max-1; i > -1 ; i--)
				checkedItems[i].removeAttribute('checked');
		}
		catch(e) {
		}

		this.list.getElementsByAttribute('value', this.offset)[0].setAttribute('checked', true);

		this.finishTakahashi();
	},
	finishTakahashi : function()
	{
		this.canvas.removeAttribute('rendering');
		this.isRendering = false;

		this.setHash('page', 'page'+(this.offset+1));

		this.next.value = (this.offset <= this.data.length-2) ?
				(
					this.data[this.offset+1].plain.join('') ||
					this.data[this.offset+1].text.join('')
				).replace(/\s+/g, ' ') :
				'(no page)' ;
		this.remainder.setAttribute(
			'value',
			this.offset == 0 ?
				0 :
				parseInt(((this.offset)/(this.data.length-1))*100)
		);

		this.lastWidth = window.innerWidth;
		this.lastHeight = window.innerHeight;

		var event = document.createEvent('Events');
		event.initEvent('PresentationRedraw', false, true);
		this.canvas.dispatchEvent(event);

		this.updateNote();
	},
	clearContent : function()
	{
		var range = document.createRange();
		range.selectNodeContents(this.content);
		var fragment = range.extractContents()
		range.detach();
		return fragment;
	},
	
	createContent : function() 
	{
		var retVal = {
				offsetWidth  : 0,
				offsetHeight : 0
			};
		var text = this.data[this.offset].text;

		var phraseTags = 'em|raw|encoded|aa|pre|style|note|#[^:{]*';

		var lineRegExp = this.makePhraseRegExp('^([^%O]+)?(%O%O('+phraseTags+'):((.+?)(:(?:'+phraseTags+'))?%C%C)?|%O%O\#[^:]+:((.+?)%C%C)?|%O%Oima?ge? +src="([^"]+)"[^%C]*?%C%C|%O%O(([^\|]+)?\\||)([^%C]+?)%C%C|%O([^%C]+?)%C)(.+)?', 'i');

		var imagesRegExp     = this.makePhraseRegExp('^([^%O]+)?%O%Oima?ge?\\s+src="([^"]+)"(\\s+(width|height)="([0-9]+%?)"(\\s+(width|height)="([0-9]+%?)")?)?\\s*[^%C]*%C%C', 'i');
		var linksRegExp      = this.makePhraseRegExp('^([^%O]+)?%O%O(([^|]+)?\\||)([^%C]+)%C%C', '');
		var montaRegExp      = this.makePhraseRegExp('^([^%O]+)?%O([^%C]+)%C', '');

		var inlineRegExp     = this.makePhraseRegExp('^([^%O]+)?%O%O('+phraseTags+')(?:{([^}]*)})?:(.+?)(?::(?:'+phraseTags+'))?%C%C', 'i');
		var blockStartRegExp = this.makePhraseRegExp('^([^%O]+)?%O%O('+phraseTags+')(?:{([^}]*)})?:(.*)', 'i');
		var blockEndRegExp   = this.makePhraseRegExp('^(.*?)((?::(?:'+phraseTags+'))?%C%C)', 'i');

		var labelId = 0;
		var inBlock       = false,
			blockClass    = '',
			blockStyle    = '',
			blockContents = [];

		var inGrid       = false,
			gridContents = null;

		var fragment = document.createDocumentFragment();

		var hidden = false;
		for (var i = 0, max = text.length; i < max; i++)
		{
			let line = text[i] || ' ' ;
			let images_width  = 0;
			let images_height = 0;

			if (line == '----') {
				hidden = true;
				continue;
			}

			let lineBox = document.createElement('hbox');
			lineBox.style.MozBoxPack = this.data[this.offset].align;
			if (hidden)
				lineBox.setAttribute('hidden-line', true);

			if (inBlock) {
				let endMatchResult = line.match(blockEndRegExp);
				if (endMatchResult) {
					inBlock = false;
					let blockContent = endMatchResult[1] || '';
					let blockEndTag = endMatchResult[2] || '';

					if (blockClass != 'note')
						blockContents.push(blockContent);
					line = line.substring((blockContent+blockEndTag).length);

					switch (blockClass)
					{
						case 'raw':
							insertXMLTo('<hbox class="raw" style="blockStyle" onclick="event.stopPropagation();" onkeypress="event.stopPropagation();">'+blockContents.join('\n')+'</hbox>', lineBox);
							break;

						case 'pre':
						case 'aa':
							lineBox.appendChild(document.createElement('description'));
							lineBox.lastChild.setAttribute('class', blockClass+' block');
							if (blockStyle)
								lineBox.lastChild.setAttribute('style', blockStyle);

							blockContents = blockContents.join('\n')
												.replace(/^[\r\n]+/, '')
												.replace(/[\r\n]+$/, '')
												.replace(/&amp;/g, '&')
												.replace(/&quot;/g, '"')
												.replace(/&gt;/g, '>')
												.replace(/&lt;/g, '<');
							if (blockClass == 'pre')
								blockContents = blockContents
												.replace(/^[\r\n\s]+/, '')
												.replace(/[\r\n\s]+$/, '');

							lineBox.lastChild.appendChild(document.createTextNode(blockContents));
							break;

						case 'note':
							break;

						default:
							lineBox.appendChild(document.createElement('vbox'));
							lineBox.lastChild.setAttribute('class', blockClass+' block');
							if (blockStyle)
								lineBox.lastChild.setAttribute('style', blockStyle);
							lineBox.lastChild.style.MozBoxAlign = this.data[this.offset].align;
							blockContents = blockContents.join('\n')
								.replace(/^[\r\n\s]+/, '')
								.replace(/[\r\n\s]+$/, '')
								.split('\n');
							for (let j = 0, jmax = blockContents.length; j < jmax; j++)
							{
								lineBox.lastChild.appendChild(document.createElement('description'));
								lineBox.lastChild.lastChild.setAttribute('value', blockContents[j]);
							}
							break;
					}

					blockClass    = '';
					blockStyle    = '';
					blockContents = [];
				}
				else {
					blockContents.push(line);
					continue;
				}
			}

			// process table rows
			if (line.indexOf('|') == 0) {
				fragment.appendChild(lineBox);

				if (fragment.childNodes.length == 1 ||
					!fragment.childNodes[fragment.childNodes.length-2] ||
					!fragment.childNodes[fragment.childNodes.length-2].lastChild ||
					fragment.childNodes[fragment.childNodes.length-2].lastChild.localName != 'grid') {
					fragment.lastChild.appendChild(document.createElement('grid'));
					fragment.lastChild.lastChild.appendChild(document.createElement('columns'));
					fragment.lastChild.lastChild.appendChild(document.createElement('rows'));
				}
				else {
					fragment.removeChild(fragment.lastChild);
				}
				fragment.lastChild.lastChild.lastChild.appendChild(document.createElement('row'));
				fragment.lastChild.lastChild.lastChild.lastChild.setAttribute('flex', 1);
				if (hidden)
					fragment.lastChild.lastChild.lastChild.lastChild.setAttribute('hidden-row', true);

				line = line.split('|');
				for (let j = 1, jmax = line.length; j < jmax; j++)
				{
					fragment.lastChild.lastChild.lastChild.lastChild.appendChild(document.createElement('vbox'));
					fragment.lastChild.lastChild.lastChild.lastChild.lastChild.style.MozBoxAlign = this.data[this.offset].align;
					if (line[j].charAt(0) == '~') {
						fragment.lastChild.lastChild.lastChild.lastChild.lastChild.setAttribute('class', 'special');
						line[j] = line[j].substring(1);
					}
					line[j] = line[j].split(/<br\s*\/>/g);
					for (let k = 0, kmax = line[j].length; k < kmax; k++)
					{
						fragment.lastChild.lastChild.lastChild.lastChild.lastChild.appendChild(document.createElement('description'));
						fragment.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.appendChild(document.createTextNode(line[j][k].replace(/^\s+|\s+$/g, '')));
					}
					if (fragment.lastChild.lastChild.firstChild.childNodes.length < j) {
						fragment.lastChild.lastChild.firstChild.appendChild(document.createElement('column'));
						fragment.lastChild.lastChild.firstChild.lastChild.setAttribute('flex', 1);
					}
				}
				continue;
			}

			let lineMatchResult;
			while (lineMatchResult = line.match(lineRegExp))
			{
				let preFirstInlineTag = lineMatchResult[1] || '';
				let firstInlineTag = lineMatchResult[2] || '';

				if (preFirstInlineTag) {
					lineBox.appendChild(document.createElement('description'));
					lineBox.lastChild.setAttribute('value', preFirstInlineTag);
				}
				let newLine = line.substring((preFirstInlineTag+firstInlineTag).length);

				let inlineMatchResult;
				let blockStartMatchResult;
				if (inlineMatchResult = line.match(inlineRegExp)) {
					let rawClassName = inlineMatchResult[2];
					let className = rawClassName.toLowerCase();
					let style     = inlineMatchResult[3];
					let contents  = inlineMatchResult[4];
					switch (className)
					{
						case 'raw':
						case 'encoded':
							insertXMLTo('<hbox class="raw" style="'+style+'" onclick="event.stopPropagation();" onkeypress="event.stopPropagation();">'+contents+'</hbox>', lineBox);
							break;

						default: // User-defined Styles
							className = rawClassName.substring(1);
						case 'pre':
						case 'aa':
						case 'em':
							lineBox.appendChild(document.createElement('description'));
							lineBox.lastChild.setAttribute('class', className);
							if (style)
								lineBox.lastChild.setAttribute('style', style);
							lineBox.lastChild.setAttribute('value', contents);
							break;

						case 'note':
							break;
					}
				}
				else if (blockStartMatchResult = line.match(blockStartRegExp)) {
					inBlock       = true;
					blockClass    = blockStartMatchResult[2].toLowerCase();
					if (blockClass.charAt(0) == '#') // User-defined Styles
						blockClass = blockStartMatchResult[2].substring(1);
					blockStyle    = blockStartMatchResult[3];
					blockContents = [blockStartMatchResult[4]];
					newLine       = '';
				}

				// Images
				else if (imagesRegExp.test(line)) {
					let image_src = RegExp.$2;
					let image_width = -1;
					let image_height = -1;
					if (RegExp.$3) {
						if (RegExp.$4.toLowerCase() == 'width')
							image_width = RegExp.$5 || '0';
						else
							image_height = RegExp.$5 || '0';
					}
					if (RegExp.$6) {
						if (RegExp.$7.toLowerCase() == 'width')
							image_width = RegExp.$8 || '0';
						else
							image_height = RegExp.$8 || '0';
					}
					lineBox.appendChild(this.createImage(image_src, image_width, image_height));
					image_width = parseInt(lineBox.lastChild.getAttribute('width'));
					image_height = parseInt(lineBox.lastChild.getAttribute('height'));
					images_width  += image_width;
					images_height = Math.max(images_height, image_height);
				}

				// Links
				else if (linksRegExp.test(line)) {
					let uri = this.resolve(RegExp.$4);
					lineBox.appendChild(document.createElement('description'));
					lineBox.lastChild.setAttribute('value', RegExp.$3 || RegExp.$4);
					lineBox.lastChild.setAttribute('href', uri);
					lineBox.lastChild.setAttribute('tooltiptext', uri);
					lineBox.lastChild.setAttribute('statustext', uri);
					lineBox.lastChild.setAttribute('class', 'link-text');

					this.clickableNodes.push(lineBox.lastChild);
				}

				// Monta
				else if (montaRegExp.test(line)) {
					lineBox.appendChild(document.createElement('stack'));

					lineBox.lastChild.appendChild(document.createElement('description'));
					lineBox.lastChild.lastChild.setAttribute('value', RegExp.$2);
					lineBox.lastChild.lastChild.setAttribute('class', 'monta-text');

					lineBox.lastChild.appendChild(document.createElement('spacer'));
					lineBox.lastChild.lastChild.setAttribute('flex', 1);
					lineBox.lastChild.lastChild.setAttribute('class', 'monta-label');

					lineBox.lastChild.lastChild.setAttribute('label-id', 'label-' + (++labelId));

					lineBox.lastChild.lastChild.setAttribute('monta-hidden', 'true');


					this.clickableNodes.push(lineBox.lastChild.lastChild);
				}

				line = newLine;
			}

			if (line) {
				lineBox.appendChild(document.createElement('description'));
				lineBox.lastChild.setAttribute('value', line);
			}

			if (images_width && lineBox.childNodes.length > 1)
				retVal.offsetWidth = Math.max(retVal.offsetWidth, images_width);
			retVal.offsetHeight += images_height;

			if (lineBox.hasChildNodes())
				fragment.appendChild(lineBox);
		}

		retVal.fragment = fragment;
		return retVal;
	},
	createImage : function(aURI, aWidth, aHeight)
	{
		aURI = this.resolve(aURI);

		var image = document.createElement('image')
		image.setAttribute('src', aURI);

		var info = this.images[aURI];
		var width = info.width;
		var height = info.height;

		if (aWidth != -1 && aWidth.indexOf('%') > 0) {
			aWidth = this.canvasWidth * Number(aWidth.replace('%', '')) * 0.01;
			aWidth = aWidth.toString();
		}
		if (aHeight != -1 && aHeight.indexOf('%') > 0) {
			aHeight = this.canvasHeight * Number(aHeight.replace('%', '')) * 0.01;
			aHeight = aHeight.toString();
		}

		if (aWidth != -1 && aHeight != -1) {
			width = parseInt(aWidth);
			height = parseInt(aHeight);
		}
		else if (aWidth != -1) {
			width = parseInt(aWidth);
			height = height / (info.width / width);
		}
		else if (aHeight != -1) {
			height = parseInt(aHeight);
			width = width / (info.height / height);
		}

		// fit to window
		var maxW = this.canvasWidth;
		var maxH = this.canvasHeight;
		if (width > maxW) {
			height = height / (width / maxW);
			width = maxW;
		}
		if (height > maxH) {
			width = width / (height / maxH);
			height = maxH;
		}

		image.setAttribute('width', width);
		image.setAttribute('height', height);
		return image;
	},
  
	fitToCanvas : function(aContent, aCanvas, aOffsetWidth, aOffsetHeight) 
	{
		aContent.removeAttribute('style');
		aContent.setAttribute('style', 'font-size:10px;');

		var grids      = aContent.getElementsByTagName('grid');
		var gridsCount = grids.length;

		if (!aContent.boxObject.width) return;

		var canvas_w  = aCanvas.boxObject.width;
		var canvas_h  = aCanvas.boxObject.height-aOffsetHeight;

		var content_w = aContent.boxObject.width;
		var new_fs = Math.round((canvas_w/content_w) * this.data[this.offset].size);
		aContent.setAttribute('style', 'font-size:'+ new_fs + "px");

		for (var i = 0; i < gridsCount; i++)
		{
			grids[i].firstChild.lastChild.removeAttribute('flex', 1);
			grids[i].firstChild.lastChild.setAttribute('flex', 1);
		}

		if (aContent.boxObject.width < aOffsetWidth) {
			content_w = aOffsetWidth;
			new_fs = Math.round((canvas_w/content_w) * this.data[this.offset].size);
			aContent.setAttribute('style', 'font-size:'+ new_fs + "px");

			for (var i = 0; i < gridsCount; i++)
			{
				grids[i].firstChild.lastChild.removeAttribute('flex', 1);
				grids[i].firstChild.lastChild.setAttribute('flex', 1);
			}
		}

		var content_h = aContent.boxObject.height;
		if(content_h >= canvas_h){
			state='height';
			content_h = aContent.boxObject.height;
			new_fs = Math.round((canvas_h/content_h) * new_fs);
			aContent.setAttribute('style', 'font-size:'+ new_fs + "px");

			for (var i = 0; i < gridsCount; i++)
			{
				grids[i].firstChild.lastChild.removeAttribute('flex', 1);
				grids[i].firstChild.lastChild.setAttribute('flex', 1);
			}
		}
	},
	
	fitMainContentToCanvas : function() 
	{
		this.fitToCanvas(
			this.content,
			this.canvas,
			parseInt(this.content.getAttribute('offsetWidth')),
			parseInt(this.content.getAttribute('offsetHeight'))
			+this.header.boxObject.height
			+this.footer.boxObject.height
		);
	},
 
	fitHeaderFooterToCanvas : function() 
	{
		this.fitToCanvas(this.header, this.header.parentNode, 0, 0);
		this.fitToCanvas(this.footer, this.footer.parentNode, 0, 0);
	},
   
	get offset(){ 
		return this._offset;
	},
	set offset(aValue){
		this._offset = parseInt(aValue || 0);
		document.documentElement.setAttribute('lastoffset', this.offset);
		return this.offset;
	},
  
/* data I/O */ 
	
	setHash : function(aKey, aValue) 
	{
		aKey = String(aKey).toLowerCase();
		var hashArray = String(location.hash).replace(/^#/, '').toLowerCase().split(',');

		for (var i = hashArray.length-1; i > -1; i--)
			if (!hashArray[i] || hashArray[i].indexOf(aKey) == 0)
				hashArray.splice(i, 1);

		if (aValue) hashArray.push(aValue);
		hashArray.sort();

		location.replace(location.href.replace(/#.*$/, '') + (hashArray.length ? '#' + hashArray.join(',') : '' ));
	},
 
	get data(){ 
		var codes = document.getElementById('builtinCode');
		if (!this._data) {
			// mozilla splits very long text node into multiple text nodes whose length is less than 4096 bytes.
			// so, we must concat all the text nodes.
			this.source.value = "";
			this.sourceData   = [];
			for (var i = 0; i < codes.childNodes.length; i++) {
				this.source.value += codes.childNodes[i].nodeValue;
			}

			this._initData(this.source.value);
		}
		if (codes)
			codes.parentNode.removeChild(codes);

		return this._data;
	},
	set data(aValue){
		this._initData(aValue);
		return this._data;
	},
	
	_initData : function(aSources) 
	{
		var range = document.createRange();

		range.selectNodeContents(this.list);
		range.deleteContents();

		var sources = this._splitDataToPages(aSources.replace(/(\r\n|[\r\n])/g, '\n'));
		var source;
		var data;

		this._data = [];
		this.sourceData = [];
		this._alias = {};

		var regexp = [
				/^[\r\n\s]+|[\r\n\s]+$/g,
				/(\r\n|[\r\n])/g
			];

		var commandLineRegExp = /^(TITLE|HEADER|FOOTER|CHAPTER|GLOBAL-ALIGN|ALIGN|GLOBAL-SIZE|SIZE|HIDDEN|GINORE|STYLE|CSS|DEFINE-ALIAS|ALIAS|LOAD|SET-TIMER|NOTE)::[ \t]*([^\n]*)[ \t]*\n?/im;

		var title;
		var header        = '';
		var footer        = '';
		var chapter       = '';
		var lastChapter;
		var alignGlobal   = 'center';
		var align;
		var size;
		var sizeGlobal  = 9;

		var imageMatchResults;
		var imagesRegExp  = this.makePhraseRegExp('%O%Oima?ge?\\s+src="[^"]+"(\\s+(width|height)="[0-9]+"(\\s+(width|height)="[0-9]+")?)?\\s*[^%C]*%C%C', 'gi');
		var imagesRegExp2 = this.makePhraseRegExp('%O%Oima?ge?\\s+src="([^"]+)"', 'i');
		var image_src;

		var plainTextRegExp = this.makePhraseRegExp('(?:%O%O\#(?:[^{:][^:]*|\{[^}]+\}):(.+)%C%C|%O%OEM:(.+)(?::EM)?%C%C|%O%OAA:(.+)(?::AA)?%C%C|%O%OPRE:(.+)(?::PRE)?%C%C|%O%ONOTE:(.+)(?::NOTE)?%C%C|%O%Oima?ge?\\s+src="[^"]*"[^%C]*%C%C|%O%O(?:[^\\|%C]+)(\\|[^%C]+)?%C%C|%O([^%O]+)%C)', 'gi');

		var noteRegExp = this.makePhraseRegExp('%O%ONOTE:(.+)(?::NOTE)?%C%C', 'i');
		var lastNote = '';

		var dataObj;
		var menuContents = document.createDocumentFragment();
		var popup;

		var dataPath;
		var parts;
		var incomplete;
		while (sources.length)
		{
			source = sources.shift();

			image_src = null;
			align     = null;
			size     = null;
			dataPath  = '';

			source = source.replace(/^\s+|\s+$/g, '');

			this.sourceData.push(source);

			let hidden = false;
			let pageNote = '';
			let commandMatchResult;
			while ((commandMatchResult = source.match(commandLineRegExp)) && !hidden) {
				source = source.replace(commandLineRegExp, '');
				let command = commandMatchResult[1].toLowerCase();
				let value = commandMatchResult[2];
				switch (command)
				{
					case 'load':
						dataPath = value;
						break;

					case 'set-timer':
						window.setTimeout(function(aSelf, aValue) {
							if (aSelf.timerTimer)
								return;
							var timeMatchResult = aValue.match(/(\d+)(.*)/);
							var time = timeMatchResult[1];
							switch((timeMatchResult[2] || '').toLowerCase())
							{
								case 's':
								case 'sec':
								case 'sec.':
								case 'second':
								case 'seconds':
									time = time / 60;
									break;

								case 'h':
								case 'hour':
								case 'hours':
									time = time * 60;
									break;

								default:
									break;
							}
							aSelf.setTimer(time);
						}, 100, this, value);
						break;

					case 'style':
					case 'css':
						document.insertBefore(
							document.createProcessingInstruction(
								'xml-stylesheet',
								'href="data:text/css,'+
									escape(source)+
									'" type="text/css"'
							),
							document.documentElement
						);
						hidden = true;
						break;

					case 'note':
						pageNote = lastNote = source;
						hidden = true;
						break;

					case 'hidden':
					case 'ignore':
						if (/^(true|yes|1)$/.test(value))
							hidden = true;
						break;

					case 'title':
						title = value || '' ;
						break;

					case 'header':
						header = value || '' ;
						break;

					case 'footer':
						footer = value || '' ;
						break;

					case 'chapter':
						chapter = value || '' ;
						break;

					case 'global-align':
					case 'align':
						align = (value || '').toLowerCase();
						if (align == 'left')
							align = 'start';
						else if (align == 'right')
							align = 'end';

						if (command == 'global-align') {
							alignGlobal = align;
							align = null;
						}
						break;

					case 'global-size':
					case 'size':
						size = Math.max(0, Number(value || this.baseSize));
						if (command == 'global-size') {
							sizeGlobal = size;
							size = null;
						}
						break;

					case 'define-alias':
					case 'alias':
						{
							let aliasMatchResult = value.match(/([^=]+)=(.+)/);
							this._alias[aliasMatchResult[1]] = aliasMatchResult[2];
						}
						break;
				}
			}
			if (hidden)
				continue;

			imageMatchResults = source.match(imagesRegExp);
			if (imageMatchResults) {
				for (let j = imageMatchResults.length-1; j > -1; j--)
					this.registerImage((imageMatchResults[j] || '').match(imagesRegExp2)[1]);
			}

			let noteMatchResults = source.replace(/\n/g, '<br/>').match(noteRegExp);
			if (noteMatchResults) {
				pageNote = lastNote = (noteMatchResults[1] || '').replace(/<br\/>/g, '\n');
			}

			source = source.replace(/^\s+|\s+$/g, '');

			parts = this._splitPageToParts(source);
			for (let i = 0; i < parts.length; i++)
			{
				source = parts.slice(0, i+1).join('');
				incomplete = i < parts.length-1;
				if (incomplete)
					source += '----\n'+parts.slice(i+1).join('');
				data = {
					load   : dataPath,
					header : header,
					footer : footer,
					text   : source.split('\n'),
					align  : align || alignGlobal,
					size   : size || sizeGlobal,
					note   : lastNote,
					incomplete : incomplete,
					pageNote : pageNote
				};
				data.plain = parts.slice(0, i+1).join('')
								.replace(plainTextRegExp, '$1$2$3$4$6$7')
								.split('\n');
				if (title !== void(0))
					data.title = title;

				data.chapter = chapter || title || '';
				if (lastChapter === void(0) ||
					lastChapter != data.chapter) {
					lastChapter = data.chapter;

					if (popup && popup.childNodes.length == 1) {
						menuContents.removeChild(menuContents.lastChild);
						menuContents.appendChild(popup.removeChild(popup.lastChild));
					}

					popup = document.createElement('menupopup');
					menuContents.appendChild(document.createElement('menu'));
					menuContents.lastChild.setAttribute('label', data.chapter);
					menuContents.lastChild.appendChild(popup);
				}

				popup.appendChild(document.createElement('menuitem'));
				popup.lastChild.setAttribute('type', 'radio');
				popup.lastChild.setAttribute('radiogroup', 'pages');
				popup.lastChild.setAttribute('label', (this._data.length+1)+': '+(
					(data.plain.join('') || data.text.join(' ')).replace(/\s+/g, ' ')
				));
				popup.lastChild.setAttribute('value', this._data.length);

				this._data.push(data);
			}
		}

		if (menuContents.childNodes.length == 1) {
			range.selectNodeContents(menuContents.firstChild.firstChild);
			menuContents = range.extractContents();
		}
		this.list.appendChild(menuContents);

		range.detach();


		this.shownMontaLabels = [];
	},
	_splitDataToPages : function(aSources)
	{
		return aSources.split(/^----+$/m);
	},
	_splitPageToParts : function(aPageSource)
	{
		return aPageSource
				.split(/^---$/m)
				.map(function(aPart) {
					return aPart.replace(/^\n/, '');
				});
	},
	resolve : function(aURI)
	{
		if (aURI && aURI in this._alias)
			aURI = this._alias[aURI];

		if (aURI.indexOf('://') < 0 &&
			aURI.indexOf('about:') < 0 &&
			aURI.indexOf('data:') < 0)
			aURI = this.dataFolder+aURI;

		return aURI;
	},
  
	get dataPath(){ 
		if (!this._dataPath)
			this.dataPath = String(location.href).replace(/#.+$/, '');
		return this._dataPath;
	},
	set dataPath(aValue){
		var oldDataPath = this._dataPath;
		this._dataPath = aValue;
		if (oldDataPath != aValue) {
			this._dataFolder = this._dataPath.split('?')[0].replace(/[^\/]+$/, '');
		}
		return this._dataPath;
	},
 
	get dataFolder(){ 
		if (!this._dataFolder)
			this.dataPath = this.dataPath;
		return this._dataFolder;
	},
	set dataFolder(aValue){
		this._dataFolder = aValue;
		return this._dataFolder;
	},
 
	loadData : function(aPath) 
	{
		this.dataPath = aPath;
		var request = new XMLHttpRequest();
		request.open('GET', aPath);
		request.onload = function() {
			Presentation.data = request.responseText;
			Presentation.init();
		};
		request.send(null);
	},
 
	readParameter : function() { 
		if (location.search || location.hash) {
			var param = location.search.replace(/^\?/, '');

			if (location.hash.match(/page([0-9]+)/i) ||
				param.match(/page=([0-9]+)/i))
				this.offset = parseInt(RegExp.$1)-1;

			if (location.hash.match(/edit/i) ||
				param.match(/edit=(1|true|yes)/i)) {
				window.setTimeout('Presentation.toggleEditMode();', 0);
			}

			if (location.hash.match(/eva/i) ||
				param.match(/eva=(1|true|yes)/i))
				this.toggleEvaMode();

			if (location.hash.match(/timer(\d+)\-(\d+)/i))
				this.setTimer(RegExp.$1, RegExp.$2);

			if (param.match(/(style|css)=([^&;]+)/i)) {
				var style = unescape(RegExp.$2);
				var pi = document.createProcessingInstruction('xml-stylesheet', 'href="'+style+'" type="text/css"');
				document.insertBefore(pi, document.documentElement);
			}

			if (param.match(/data=([^&;]+)/i)) {
				this.loadData(RegExp.$1);
				return false;
			}
		}
		return true;
	},
 
	registerImage : function(aURI) 
	{
		aURI = this.resolve(aURI);
		if (aURI in this.images) return;

		var info = {
			width  : -1,
			height : -1,
			loaded : false
		};
		info.image = new Image();
		info.image.src = aURI;
		info.image.addEventListener('load', function() {
			info.width = info.image.width;
			info.height = info.image.height;
			info.loaded = true;
			info.image.removeEventListener('load', arguments.callee, false);
		}, false);
		this.images[aURI] = info;
	},
	images : {},
  
/* commands */ 
	
	reload : function() { 
		var file = String(location.href).replace(/#.+$/, '');
		if (this.dataPath != file) {
			var path = this.dataPath;
			var request = new XMLHttpRequest();
			request.open('GET', path);
			request.onload = function() {
				Presentation.data = request.responseText;
				Presentation.init();

				path = null;
				request = null;
			};
			request.send(null);
		}
		else
			window.location.reload();
	},
 
	forward : function(){ 
		if (!this.canForward) return;
		this.offset++;
		this.takahashi();
	},
	
	forwardStep : function(){ 
		if (!this.canForward) return;
		var monta = document.getElementsByAttribute('monta-hidden', 'true');
		if (monta && monta.length) {
			this.showMontaKeyword(monta[0]);
		}
		else
			this.forward();
	},
  
	back : function(){ 
		if (!this.canBack) return;
		this.offset--;
		if(this.offset < 0){this.offset = 0}
		this.takahashi();
	},
 
	home : function(){ 
		if (!this.canMove) return;
		this.offset = 0;
		this.takahashi();
	},
 
	end : function(){ 
		if (!this.canMove) return;
		this.offset = this.data.length-1;
		this.takahashi();
	},
 
	showPage : function(aPageOffset){ 
		if (!this.canMove) return;
		this.offset = aPageOffset ? aPageOffset : 0 ;
		this.takahashi();
	},
 
	toggleEditMode : function() 
	{
		if (this.deck.selectedIndex == 1) {
			if (document.getElementById('editTabBox').selectedTab.id == 'editTab-pages') {
				this.source.value = this.sourceData.join('\n----\n');
			}
			this.data = this.source.value;
			this.cachedContents = [];
			var range = document.createRange();
			range.selectNodeContents(this.content);
			range.deleteContents();
			range.detach();
			this.init();
		}
		else {
			this.initEditPages();
		}

		this.deck.selectedIndex = this.deck.selectedIndex == 0 ? 1 : 0 ;
		this.setHash('edit', this.deck.selectedIndex == 0 ? '' : 'edit' );
	},
 
	toggleEvaMode : function() 
	{
		var check = document.getElementById('toggleEva');
		if (this.canvas.getAttribute('eva') == 'true') {
			this.canvas.removeAttribute('eva');
			this.logo.removeAttribute('eva');
			check.checked = false;
		}
		else {
			this.canvas.setAttribute('eva', true);
			this.logo.setAttribute('eva',true);
			check.checked = true;
		}
		this.setHash('eva', check.checked ? 'eva' : '' );
	},
 
	toggleNote : function()
	{
		if (this.noteWindow && !this.noteWindow.closed) {
			this.noteWindow.close();
			this.noteWindow = null;
		}
		else {
			this.noteWindow = window.open('about:blank', 'takahashi_xul_note_window');
			this.updateNote();
		}
	},
	updateNote : function()
	{
		this.noteButtonBox.hidden = !this.data[this.offset].pageNote;

		if (!this.noteWindow)
			return;

		if (this.noteWindow.closed) {
			this.noteWindow = null;
			return;
		}
		var w = this.noteWindow;
		window.setTimeout(function(aNote) {
			if (w.document.body.firstChild &&
				w.document.body.firstChild.textContent == aNote)
				return;

			w.document.body.innerHTML = '<pre style="white-space:pre-wrap; font-size: large;"></pre>';
			w.document.body.firstChild.textContent = aNote;
		}, 100, this.data[this.offset].note);
	},
	showNoteText : function() 
	{
		if (this.noteTextShown) return;
		this.noteTextShown = true;
		this.noteTextBox.removeAttribute('hidden');
		this.noteTextField.style.width = parseInt(this.canvasWidth * 0.8)+'px';
		this.noteTextField.style.height = parseInt(this.canvasHeight * 0.8)+'px';
		this.noteTextField.value = this.data[this.offset].pageNote;
		this.noteTextField.focus();
	},
	hideNoteText : function() 
	{
		if (!this.noteTextShown) return;
		this.noteTextShown = false;
		this.noteTextBox.setAttribute('hidden', true);
		this.noteTextField.value = '';
	},
	noteTextShown : false,
	get noteTextBox()
	{
		return document.getElementById('noteTextBox');
	},
	get noteTextField()
	{
		return document.getElementById('noteTextField');
	},
  
/* auto cruise */ 
	
	toggleAutoCruiseMode : function() 
	{
		var autoCruise = document.getElementById('autoButton');
		if(!autoCruise.checked)
			this.startAutoCruise();
		else
			autoCruise.checked = false;
	},
 
	startAutoCruise : function() 
	{
		var autoCruise = document.getElementById('autoButton');
		autoCruise.checked = true;

		if (this.autoCruiseTimer) {
			window.clearTimeout(this.autoCruiseTimer);
		}
		this.autoCruiseTimer = window.setTimeout(this.autoCruise, this.autoCruiseInterval);
	},
 
	changeAutoCruiseInterval : function(aInterval) 
	{
		this.autoCruiseInterval = aInterval;
		this.startAutoCruise();
	},
 
	autoCruise : function() 
	{
		var autoCruise = document.getElementById('autoButton');
		if (!autoCruise.checked) return;

		if (Presentation.offset == Presentation.data.length-1) {
			if (Presentation.canMove)
				Presentation.home();
		}
		else {
			if (Presentation.canForward)
				Presentation.forwardStep();
		}
		Presentation.autoCruiseTimer = window.setTimeout(arguments.callee, Presentation.autoCruiseInterval);
	},
	autoCruiseTimer : null,
  
/* timer */ 
	
	resetTimer : function() 
	{
		if (this.timerTimer) {
			window.clearInterval(this.timerTimer);
			this.timerTimer = null;
		}
		this.timer.setAttribute('value', 0);
		this.timer.setAttribute('collapsed', true);
		this.setHash('timer', '');
	},
 
	setTimer : function(aStart, aEnd) 
	{
		var now = Date.now();
		if (aStart !== void(0) && aEnd === void(0)) {
			var rest = Math.abs(aStart);
			this.timerStart = now;
			this.timerEnd   = this.timerStart + (rest * 60000);
		}
		else if (aStart === void(0) && aEnd === void(0)) {
			var rest = prompt('Remaining Time (minits)');
			if (rest == '') {
				this.resetTimer();
				return;
			}
			else {
				rest = Number(rest);
				if (!rest || isNaN(rest)) return;
			}

			rest = Math.abs(rest);
			this.timerStart = now;
			this.timerEnd   = this.timerStart + (rest * 60000);
		}
		else {
			aStart = Number(aStart);
			aEnd   = Number(aEnd);
			if (isNaN(aStart) || isNaN(aEnd)) return;

			this.timerStart = Math.min(aStart, aEnd);
			this.timerEnd   = Math.max(aStart, aEnd);

			if (this.timerStart >= now || this.timerEnd <= now) return;
		}

		this.resetTimer();

		this.timer.removeAttribute('collapsed');
		this.setHash('timer', 'timer'+this.timerStart+'-'+this.timerEnd);

		if (now != this.timerStart)
			this.updateTimer(this);

		this.timerTimer = window.setInterval(this.updateTimer, Math.min(this.timerUpdatingInterval, (this.timerEnd-this.timerStart)/(this.data.length*2)), this);
	},
	
	timerStart : 0, 
	timerEnd   : 0,
	timerTimer : null,
 
	updateTimer : function(aThis) 
	{
		var now = Date.now();
		if (now >= aThis.timerEnd) {
			aThis.resetTimer();
			aThis.timer.setAttribute('value', 100);
			aThis.timer.removeAttribute('collapsed');
			aThis.setHash('timer', '');
		}
		else {
			var value = parseInt(((now - aThis.timerStart) / (aThis.timerEnd - aThis.timerStart)) * 100);
			aThis.timer.setAttribute('value', value);
		}
	},
  
	updateTimerItem : function() 
	{
		var item = document.getElementById('timerItem');
		if (this.timerTimer) {
			item.setAttribute('label', item.getAttribute('label-active').replace(/%s/gi, Math.round((this.timerEnd - Date.now()) / 60000)));
		}
		else {
			item.setAttribute('label', item.getAttribute('label-normal'));
		}
	},
  
/* export */
	EXPORT_FAILED_MOVING : 1,
	export : function(aOnExported, aOnExportFinished, aSize)
	{
		if (!this.canMove)
			return this.EXPORT_FAILED_MOVING;

		this.finishExport();

		if (!this.isToolbarHidden)
			this.showHideToolbar(true);

		this.isExporting = true;
		this._onExported = aOnExported;
		this._onExportFinished = aOnExportFinished;
		this._exportedCount = 0;

		if (!this._exportCanvas)
			this._exportCanvas = document.createElementNS(XHTMLNS, 'canvas');

		this.home();
		this.processExportWithDelay(aSize);
	},

	processExportWithDelay : function(aSize)
	{
		if (this._exportTimer)
			window.clearInterval(this._exportTimer);

		var self = this;
		this._exportTimer = window.setTimeout(function() {
			self.processExport(aSize);
		}, 10);
	},
	processExport : function(aSize) 
	{
		if (!this.canMove)
			return this.processExportWithDelay(aSize);

		if (!this.data[this.offset].incomplete) {
			var monta = document.getElementsByAttribute('monta-hidden', 'true');
			if (monta && monta.length) {
				for (var i = monta.length-1; i > -1; i--)
					this.showMontaKeyword(monta[i], true);
			}

			var w = window.innerWidth;
			var h = window.innerHeight;
			var exportSize = aSize || 1;
			var canvasW = parseInt(w * exportSize);
			var canvasH = parseInt(h * exportSize);

			this._exportCanvas.width  = canvasW;
			this._exportCanvas.height = canvasH;
			this._exportCanvas.style.border = 'black solid medium';

			try {
				if (window.netscape &&
					netscape.security &&
					netscape.security.PrivilegeManager &&
					netscape.security.PrivilegeManager.enablePrivilege)
					netscape.security.PrivilegeManager.enablePrivilege('UniversalBrowserRead');

				var ctx = this._exportCanvas.getContext('2d');
				ctx.clearRect(0, 0, canvasW, canvasH);
				ctx.save();
				ctx.scale(aSize, aSize);
				ctx.drawWindow(window, 0, 0, w, h, 'rgb(255,255,255)');
				ctx.restore();

				if (!this._onExported(this._exportCanvas, this._exportedCount++))
					return this.processExportWithDelay(aSize); // retry
			}
			catch(e) {
				alert('Error: Failed to export.\n\n------\n'+e);
				this.finishExport();
				return;
			}
		}

		if (this.offset == this.data.length-1) {
			this.finishExport();
			this.home();
		}
		else {
			this.forward();
			this.processExportWithDelay(aSize);
		}
	},
  
	finishExport : function() 
	{
		window.clearInterval(this._exportTimer);

		if (this._onExportFinished)
			this._onExportFinished();

		this._exportTimer = null;
		this._onExported = null;
		this._onExportFinished = null;
		this._exportedCount = 0;
		this.isExporting = false;
	},
 
	_exportTimer  : null,
	_exportCanvas : null,

/* export to folder */ 
	exportToFolder : function() 
	{
		if (!window.Components || !window.Components.classes) {
			alert('XPConnect is not available. This feature cannot work without installation.');
			return;
		}
		if (!this.canMove) {
			alert('Please wait for a while, and retry later.');
			return;
		}

		this.finishExport();

		var deltaW = 1024 - window.innerWidth;
		var deltaH = 768 - window.innerHeight;
		window.resizeBy(deltaW, deltaH);

		var picker = Components.classes['@mozilla.org/filepicker;1']
						.createInstance(Components.interfaces.nsIFilePicker);
		picker.init(window, 'Choose the output folder', picker.modeGetFolder);

		function findExistingFolder(aFile) {
			// Windows's file picker sometimes returns wrong path like
			// "c:\folder\folder" even if I actually selected "c:\folder".
			// However, when the "OK" button is chosen, any existing folder
			// must be selected. So, I find existing ancestor folder from
			// the path.
			while (aFile && !aFile.exists() && aFile.parent)
			{
				aFile = aFile.parent;
			}
			return aFile;
		}

		var self = this;

		if (typeof picker.open != 'function') { // Firefox 18 and olders
			let folder = (picker.show() == picker.returnOK) ?
							picker.file.QueryInterface(Components.interfaces.nsILocalFile) : null ;
			window.setTimeout(function() {
				folder = findExistingFolder(folder);
				self.doExportToFolder(folder, deltaW, deltaH);
			}, 0);
			return;
		}

		picker.open({ done: function(aResult) {
			if (aResult == picker.returnOK) {
				let folder = picker.file.QueryInterface(Components.interfaces.nsILocalFile);
				folder = findExistingFolder(folder);
				self.doExportToFolder(folder, deltaW, deltaH);
			}
			else {
				self.doExportToFolder(null, deltaW, deltaH);
			}
		}});
	},
	doExportToFolder : function(aFolder, aDeltaW, aDeltaH)
	{
		var win = Components.classes['@mozilla.org/appshell/window-mediator;1']
				.getService(Components.interfaces.nsIWindowMediator)
				.getMostRecentWindow('navigator:browser');
		var self = this;
		this.export(
			function onExported(aCanvas, aIndex) {
				return self.onImageExported(aCanvas, aIndex, win, aFolder);
			},
			function onExportFinished() {
				window.resizeBy(-aDeltaW, -aDeltaH);
			}
		);
	},
	onImageExported : function(aCanvas, aIndex, aChromeWindow, aFolder)
	{
		var uri;
		var filename = ('0000' + aIndex).slice(-4);
		if (this.imageType == 'jpeg') {
			uri = aCanvas.toDataURL('image/jpeg', 'quality=50');
			filename += '.jpg';
		}
		else {
			uri = aCanvas.toDataURL('image/png', 'transparency=none');
			filename += '.png';
		}

		var destFile = aFolder.clone();
		destFile.append(filename);

		var IOService = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		uri = IOService.newURI(uri, null, null);
		var autoChosen = new aChromeWindow.AutoChosen(destFile, uri);

		if (aChromeWindow.internalSave.length < 12) { // Firefox 16 and olders
			aChromeWindow.internalSave(
				uri.spec,
				null, // document
				filename, // default file name
				null, // content disposition
				this.imageType,
				false, // should bypass cache?
				null, // title of picker
				autoChosen,
				null, // referrer
				true, // skip prompt?
				null // cache key
			);
		}
		else {
			aChromeWindow.internalSave(
				uri.spec,
				null, // document
				filename, // default file name
				null, // content disposition
				this.imageType,
				false, // should bypass cache?
				null, // title of picker
				autoChosen,
				null, // referrer
				document, // initiating document
				true, // skip prompt?
				null // cache key
			);
		}

		return true;
	},

/* print */ 
	
	printFullSize : 0.9,
	printHalfSize : 0.4,
	printWindow : null,
	print : function(aHalfSizeMode) 
	{
		if (!this.canMove) {
			alert('Please wait for a while, and retry later.');
			return;
		}

		this.finishExport();
		if (this.printWindow) {
			this.printWindow.close();
			this.printWindow = null;
		}

		var uri = 'data:text/html,'+encodeURIComponent('<!DOCTYPE html>\n<html><head><meta charset="UTF-8" /><title>'+document.title+'</title></head><body></body></html>');
		this.printWindow = window.open(uri, 'PresentationPrint', 'dependent=yes,hotkeys=yes,location=yes,menubar=yes,personalbar=yes,scrollbars=yes,status=yes,toolbar=yes');
		if (!this.printWindow)
			return;

		var size = aHalfSizeMode ? this.printHalfSize : this.printFullSize ;

		var self = this;
		this.export(
			function onExported(aCanvas, aIndex) {
				return self.onPrintExported(aCanvas, aIndex. aHalfSizeMode, size);
			},
			function onExportFinished() {
				self.onPrintExportFinished();
			},
			size
		);
	},
	onPrintExported : function(aCanvas, aIndex, aHalfSizeMode, aSize)
	{
		var doc  = this.printWindow.document;
		var body = doc.getElementsByTagName('body')[0];
		if (!body) // not loaded yet
			return false;

		var uris = [];
		if (!aHalfSizeMode) {
			let links = document.querySelectorAll('.link-text[href]');
			Array.forEach(links, function(aLink) {
				let uri = aLink.getAttribute('href');
				if (uri &&
					!/^(javascript:|#)/.test(uri) &&
					uris.indexOf(uri) < 0)
					uris.push(uri);
			});
		}

		var img  = doc.createElement('img');

		var count = doc.querySelectorAll('.takahashi-method-xul-page').length;
		if (!aHalfSizeMode || (count+1) % 2 == 1) {
			body.appendChild(doc.createElement('div'));
//			body.lastChild.style.clear = 'both';
		}
		var box = doc.createElement('div');
		box.setAttribute('class', 'takahashi-method-xul-page');
		box.appendChild(doc.createElement('div'));
		box.lastChild.appendChild(document.createTextNode(count+1));
		body.lastChild.appendChild(box);

		img.style.border = 'black solid medium';
		img.style.width  = aCanvas.width+'px';
		img.style.height = aCanvas.height+'px';

		box.style.margin = '1em';
		box.style.width  = parseInt(window.innerWidth * aSize)+'px';
		if (aHalfSizeMode)
			box.style.cssFloat  = ((count+1) % 2 == 1) ? 'left' : 'right' ;

		if (this.imageType == 'jpeg')
			img.src = aCanvas.toDataURL('image/jpeg', 'quality=50');
		else
			img.src = aCanvas.toDataURL('image/png', 'transparency=none');
		box.appendChild(img);

		if (uris.length) {
			let ul = doc.createElement('ul');
			for (let [i, uri] in Iterator(uris))
			{
				let link = doc.createElement('a');
				link.setAttribute('href', uri);
				link.appendChild(doc.createTextNode(uri));
				let li = doc.createElement('li');
				li.appendChild(link);
				ul.appendChild(li);
			}
			box.appendChild(ul);
		}

		return true;
	},
	onPrintExportFinished: function() {
		this.printWindow.focus();
	},
  
/* view source */ 
	
	plainTextShown : false, 
 
	get plainTextBox() 
	{
		return document.getElementById('plainTextBox');
	},
 
	get plainTextField() 
	{
		return document.getElementById('plainTextField');
	},
 
	showPlainText : function() 
	{
		if (this.plainTextShown) return;
		this.plainTextShown = true;
		this.plainTextBox.removeAttribute('hidden');
		this.plainTextField.style.width = parseInt(this.canvasWidth * 0.8)+'px';
		this.plainTextField.style.height = parseInt(this.canvasHeight * 0.8)+'px';
		this.plainTextField.value = this.data[this.offset].text.join('\n').replace(/\u200b/g, '');
		this.plainTextField.select();
		this.plainTextField.focus();
	},
 
	hidePlainText : function() 
	{
		if (!this.plainTextShown) return;

		var modified = false;
		var value = this.plainTextField.value.split('\n');
		if (this.data[this.offset].text.toSource() != value.toSource()) {
			this.data[this.offset].text = value;
			delete this.cachedContents[this.offset];
			modified = true;
		}

		this.plainTextShown = false;
		this.plainTextBox.setAttribute('hidden', true);
		this.plainTextField.value = '';
		this.plainTextField.blur();

		if (modified)
			this.takahashi();
	},
  
/* state */ 
	
	get canMove() 
	{
		return (
				this.isRendering ||
				this.montaAnimating
			) ? false : true ;
	},
 
	get canBack() 
	{
		return this.canMove;
	},
 
	get canForward() 
	{
		return this.canMove;
	},
 
	get isPresentationMode(){ 
		return (this.deck.selectedIndex == 0);
	},
  
/* event handling */ 
	
	handleEvent : function(aEvent) 
	{
		if (aEvent.type == 'unload') {
			if (this.noteWindow && !this.noteWindow.closed)
				this.noteWindow.close();
			return;
		}

		if (this.isExporting) return;

		var node = aEvent.target;
		var inRawContents = false;
		do {
			if (node.nodeType == Node.ELEMENT_NODE &&
				/\braw\b/i.test(node.getAttribute('class'))) {
				inRawContents = true;
				break;
			}

			node = node.parentNode;
			if (node == document) break;
		}
		while (node && node.parentNode)


		switch (aEvent.type)
		{
			default:
				break;

			case 'resize':
				if (this.onResizeTimer) {
					window.clearTimeout(this.onResizeTimer);
					this.onResizeTimer = null;
				}
				this.onResizeTimer = window.setTimeout(function(aSelf) {
					aSelf.onResizeTimer = null;
					if (
						inRawContents ||
						aSelf.lastWidth != window.innerWidth ||
						aSelf.lastHeight != window.innerHeight
						) {
						aSelf.cachedContents = [];
						aSelf.takahashi(); // redraw
					}
				}, 250, this);
				break;

			case 'contextmenu':
				aEvent.stopPropagation();
				aEvent.preventDefault();
				break;


			case 'mouseup':
				if (inRawContents) return;
				this.dragStartX = -1;
				this.dragStartY = -1;
				if (this.indicatorBar.dragging)
					this.onIndicatorBarDragEnd(aEvent);
				break;

			case 'mousedown':
				if (inRawContents) return;
				if (this.dragStartX < 0) {
					this.dragStartX = aEvent.clientX;
					this.dragStartY = aEvent.clientY;
				}
				var box = this.indicatorBar.boxObject;
				if (!(aEvent.screenX < box.screenX ||
					aEvent.screenY < box.screenY ||
					aEvent.screenX > box.screenX+box.width ||
					aEvent.screenY > box.screenY+box.height))
					this.onIndicatorBarDragStart();
				break;

			case 'mousemove':
				if (inRawContents) return;
				this.checkShowHideToolbar(aEvent);
				if (this.indicatorBar.dragging) {
					this.onIndicatorBarDragMove(aEvent);
					return;
				}
				if (this.dragStartX > -1) {
					if (Math.abs(this.dragStartX-aEvent.clientX) > Math.abs(this.dragStartDelta) ||
						Math.abs(this.dragStartY-aEvent.clientY) > Math.abs(this.dragStartDelta)) {
						var event = document.createEvent('Events');
						event.initEvent('StartDragOnCanvas', false, true);
						this.canvas.dispatchEvent(event);
					}
				}
				break;

			case 'DOMMouseScroll':
				if (
					(aEvent.detail > 0 && this.scrollCounter < 0) ||
					(aEvent.detail < 0 && this.scrollCounter > 0)
					)
					this.scrollCounter = 0;

				this.scrollCounter += aEvent.detail;
				if (Math.abs(this.scrollCounter) >= this.scrollThreshold) {
					if (aEvent.detail > 0)
						Presentation.forwardStep();
					else
						Presentation.back();

					this.scrollCounter = 0;
				}
				break;
		}
	},
	 
	dragStartX : -1, 
	dragStartY : -1,
	scrollCounter : 0,
	scrollThreshold : 10,
  
	onKeyPress : function(aEvent) { 
		if (this.isExporting) return;

		switch(aEvent.keyCode)
		{
			case aEvent.DOM_VK_BACK_SPACE:
				if (this.isPresentationMode) {
					aEvent.stopPropagation();
					aEvent.preventDefault();
					Presentation.back();
				}
				break;
			default:
				break;
		}
	},
 
/* actions on presentation */ 
	 
	onPresentationClick : function(aEvent) 
	{
		if (this.isExporting) {
			if (confirm('Do you want printing operation to be stopped?')) {
				this.finishExport();
			}
			return;
		}

		if (!this.isToolbarHidden)
			this.showHideToolbar();

		switch(aEvent.button)
		{
			case 0:
				switch (aEvent.target.getAttribute('class'))
				{
					case 'link-text':
						var uri = aEvent.target.getAttribute('href');
						if (uri) {
							window.open(uri);
							return;
						}
						break;

					case 'monta-label':
						if (aEvent.target.getAttribute('monta-hidden') == 'true') {
							this.showMontaKeyword(aEvent.target);
							aEvent.stopPropagation();
							return;
						}

					default:
						break;
				}
				this.forward();
				document.documentElement.focus();
				break;
			case 2:
				this.back();
				document.documentElement.focus();
				break;
			default:
				break;
		}
	},
 
/* scrollbar */ 
	
	onScrollerDragStart : function(){ 
		if (this.isExporting) return;

		this.scroller.dragging = true;
	},
 
	onScrollerDragMove : function(){ 
		if (this.isExporting) return;

		if (this.scroller.dragging)
			this.showPage(parseInt(this.scroller.getAttribute('curpos')));
	},
 
	onScrollerDragDrop : function(){ 
		if (this.isExporting) return;

		this.onScrollerDragMove();
		this.scroller.dragging = false;
	},
  
/* indicator bar */ 
	
	onIndicatorBarClick : function(aEvent) 
	{
		if (this.isExporting) return;

		var bar = this.indicatorBar;
		this.showPage(Math.round((aEvent.screenX - bar.boxObject.screenX) / bar.boxObject.width * this.data.length));
	},
 
	onIndicatorBarDragStart : function() 
	{
		if (this.isExporting) return;

		this.indicatorBar.dragging = true;
	},
 
	onIndicatorBarDragMove : function(aEvent) 
	{
		if (this.isExporting) return;

		var bar = this.indicatorBar;
		this.showPage(Math.round((aEvent.screenX - bar.boxObject.screenX) / bar.boxObject.width * this.data.length));
	},
 
	onIndicatorBarDragEnd : function(aEvent) 
	{
		if (this.isExporting) return;

		this.onIndicatorBarDragMove(aEvent);
		this.indicatorBar.dragging = false;
	},
  
	showMontaKeyword : function(aNode, aWithoutAnimation) { 
		if (aNode.getAttribute('monta-hidden') != 'true') return;

		if (aWithoutAnimation) {
			aNode.setAttribute('monta-hidden', 'false');
			return;
		}

		aNode.setAttribute('monta-hidden', 'progress');

		this.montaAnimating = true;

		window.setTimeout(this.showMontaKeywordCallback, 0, {
			position : -100,
			node     : aNode,
			interval : this.showMontaKeywordDuration/10
		});
	},
	
	showMontaKeywordCallback : function(aInfo) { 
		if (aInfo.position >= aInfo.node.boxObject.width) {
			aInfo.node.setAttribute('monta-hidden', 'false');
			Presentation.montaAnimating = false;
			return;
		}

		aInfo.position += (aInfo.node.boxObject.width/10);
		aInfo.node.setAttribute('style', 'background-position: '+aInfo.position+'px 0 !important;');
		window.setTimeout(arguments.callee, aInfo.interval, aInfo);
	},
	montaAnimating : false,
    
/* toolbar animation */ 
	
	onToolbarArea   : false, 
	toolbarHeight   : 0,
	toolbarDelay    : 300,
	toolbarTimer    : null,
	isToolbarHidden : false,
 
	checkShowHideToolbar : function(aEvent) { 
		if (!this.scroller || this.scroller.dragging || this.preventToShowHideToolbar) return;

		this.onToolbarArea = aEvent.clientY < (this.toolbarHeight * 1.5);

		if (this.isToolbarHidden == this.onToolbarArea) {
			if (this.toolbarTimer) window.clearTimeout(this.toolbarTimer);
			this.toolbarTimer = window.setTimeout('Presentation.checkShowHideToolbarCallback()', this.toolbarDelay);
		}
	},
	
	checkShowHideToolbarCallback : function() { 
		if (this.isToolbarHidden == this.onToolbarArea)
			this.showHideToolbar();
	},
  
	showHideToolbar : function(aWithoutAnimation) 
	{
		if (this.isExporting) return;

		if (this.toolbarAnimationTimer) window.clearTimeout(this.toolbarAnimationTimer);

		this.toolbarAnimationInfo = { count : 0 };
		if (this.isToolbarHidden) {
			this.toolbarAnimationInfo.start = 0;
			this.toolbarAnimationInfo.end   = this.toolbarHeight;
		}
		else {
			this.toolbarAnimationInfo.start = this.toolbarHeight;
			this.toolbarAnimationInfo.end   = 0;
		}
		this.toolbarAnimationInfo.current = 0;

		this.toolbar.setAttribute('style', 'margin-top:'+(0-(this.toolbarHeight-this.toolbarAnimationInfo.start))+'px; margin-bottom:'+(0-this.toolbarAnimationInfo.start)+'px;');

		if (aWithoutAnimation) {
			this.toolbarAnimationInfo.current = this.toolbarHeight;
			Presentation.animateToolbar();
		}
		else {
			this.toolbarAnimationTimer = window.setTimeout('Presentation.animateToolbar()', this.toolbarAnimationDelay/this.toolbarAnimationSteps);
		}
	},
	
	animateToolbar : function() 
	{
		this.toolbarAnimationInfo.current += parseInt(this.toolbarHeight/this.toolbarAnimationSteps);

		var top, bottom;
		if (this.toolbarAnimationInfo.start < this.toolbarAnimationInfo.end) {
			top    = this.toolbarHeight-this.toolbarAnimationInfo.current;
			bottom = this.toolbarAnimationInfo.current;
		}
		else {
			top    = this.toolbarAnimationInfo.current;
			bottom = this.toolbarHeight-this.toolbarAnimationInfo.current;
		}

		top    = Math.min(Math.max(top, 0), this.toolbarHeight);
		bottom = Math.min(Math.max(bottom, 0), this.toolbarHeight);

		this.toolbar.setAttribute('style', 'margin-top:'+(0-top)+'px; margin-bottom:'+(0-bottom)+'px');

		if (this.toolbarAnimationInfo.count < this.toolbarAnimationSteps) {
			this.toolbarAnimationInfo.count++;
			this.toolbarAnimationTimer = window.setTimeout('Presentation.animateToolbar()', this.toolbarAnimationDelay/this.toolbarAnimationSteps);
		}
		else
			this.isToolbarHidden = !this.isToolbarHidden;
	},
 
	toolbarAnimationDelay : 100, 
	toolbarAnimationSteps : 5,
	toolbarAnimationInfo  : null,
	toolbarAnimationTimer : null,
   
/* edit mode */ 
	 
	initEditPages : function() 
	{
		var range = document.createRange();
		range.selectNodeContents(this.pages);
		range.deleteContents();
		range.detach();

		var editBox  = document.getElementById('pageEditBoxTemplate');
		var contents = document.createDocumentFragment();
		for (var i = 0, maxi = this.sourceData.length; i < maxi; i++)
		{
			var newBox = editBox.cloneNode(true);
			newBox.firstChild.setAttribute('value', this.sourceData[i])
			newBox.setAttribute('id', this.EDIT_BOX_ID_PREFIX+i);
			contents.appendChild(newBox);
		}

		this.pages.appendChild(contents);
	},
 
	toggleEditStyle : function(aEvent) 
	{
		if (!this.source) return;
		var tabbox = document.getElementById('editTabBox');
		var tab = tabbox.selectedTab;
		if (tab.id == 'editTab-pages') {
			this.sourceData = this.source.value.split(/\n?----+\n?/);
			this.initEditPages();
		}
		else {
			this.source.value = this.sourceData.join('\n----\n');
		}
	},
 
	insert : function(aType) { 
		switch (aType)
		{
			case 'page':
				this.insertTextFor('\n----\n', this.source, 6);
				break;
			case 'header':
				this.insertTextFor('\nHEADER::\n', this.source, 9);
				break;
			case 'footer':
				this.insertTextFor('\nFOOTER::\n', this.source, 9);
				break;

			case 'em':
			case 'emphasis':
				this.insertTextFor(this.phraseOpenParen+this.phraseOpenParen+'EM:'+this.phraseCloseParen+this.phraseCloseParen, this.source, 5);
				break;
			case 'pre':
			case 'preformatted':
				this.insertTextFor(this.phraseOpenParen+this.phraseOpenParen+'PRE:'+this.phraseCloseParen+this.phraseCloseParen, this.source, 6);
				break;
			case 'monta':
				this.insertTextFor(this.phraseOpenParen+this.phraseCloseParen, this.source, 1);
				break;
			case 'link':
				this.insertTextFor(this.phraseOpenParen+this.phraseOpenParen+'|http://'+this.phraseCloseParen+this.phraseCloseParen, this.source, 2);
				break;
			case 'img':
			case 'image':
				this.insertTextFor(this.phraseOpenParen+this.phraseOpenParen+'image src="" width="" height=""'+this.phraseCloseParen+this.phraseCloseParen, this.source, 13);
				break;

			default:
				return;
		}
		this.onEditSource();
	},
	
	insertTextFor : function(aString, aNode, aPosOffset) 
	{
		var pos = aNode.selectionStart;
		var value = aNode.value;
		aNode.value = [value.substring(0, pos), aString, value.substring(pos, value.length)].join('');
		aNode.selectionEnd = aNode.selectionStart = pos + (aPosOffset || 0);
	},
  
	removePage : function(aPage) 
	{
		if (aPage === void(0) || this.pages.childNodes.length == 1) return;

		var target = document.getElementById(this.EDIT_BOX_ID_PREFIX+aPage);

		var next = target;
		while (next = next.nextSibling)
		{
			next.setAttribute('id', this.EDIT_BOX_ID_PREFIX + (Number(next.id.match(/\d+/)) - 1));
		}
		this.pages.removeChild(target);

		this.sourceData.splice(aPage, 1);

		var maxPage = this.pages.childNodes.length-1;
		if (this.offset > maxPage) this.offset = maxPage;

		this.onEditPage();
	},
 
	onEditSource : function() { 
		if (this.isExporting) return;
	},

 
	onEditPage : function(aPage) 
	{
		if (aPage !== void(0)) {
			var target = document.getElementById(this.EDIT_BOX_ID_PREFIX+aPage);
			if (target) {
				target = getNodesByXPath('descendant::*[@class="page-edit-box-main"]', target).snapshotItem(0);
				this.sourceData[aPage] = target.value;
			}
		}
	},
 
	output : function() 
	{
		location.href = 'data:application/octet-stream,'+encodeURIComponent(this.source.value);
	}
  
}; 
  	
var StrokeService = { 
	
	className      : 'stroke-dot', 
	dragStartDelta : 10,
	lineColor      : 'red',
	lineWidth      : 3,

	initialized : false,


	mode          : null,
	canvas        : null,
	canvasContext : null,
	startX        : -1,
	startY        : -1,
 
	init : function(aCanvas) 
	{
		this.initialized = true;

		this.canvas = aCanvas;
		this.canvasElement = aCanvas;

		var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		canvas.width = this.canvas.boxObject.width;
		canvas.height = this.canvas.boxObject.height;
		this.canvas.appendChild(canvas);
		if (!('getContext' in canvas) || !canvas.getContext) {
			this.canvas.removeChild(canvas);
			this.mode = 'box';
		}
		else {
			this.canvasElement = canvas;
			this.canvasContext = canvas.getContext('2d');
			this.mode          = 'canvas';
		}

		document.documentElement.addEventListener('PresentationRedraw', this, false);
		window.addEventListener('resize', this, false);
		this.canvasElement.addEventListener('mouseup',   this, false);
		this.canvasElement.addEventListener('mousedown', this, false);
		this.canvasElement.addEventListener('mousemove', this, false);

		this.canvasElement.addEventListener('click', this, false);
		this.canvasElement.addEventListener('dblclick', this, false);

		this.clear();
	},
 
	destroy : function() 
	{
		document.documentElement.removeEventListener('PresentationRedraw', this, false);
		window.removeEventListener('resize', this, false);
		if (this.canvasElement) {
			this.canvasElement.removeEventListener('mouseup', this, false);
			this.canvasElement.removeEventListener('mousedown', this, false);
			this.canvasElement.removeEventListener('mousemove', this, false);
			this.canvasElement.removeEventListener('click', this, false);
		}

		this.cliclableNodesManager = null;
		this.canvasElement = null;
		this.canvas = null;

		this.initialized = false;
	},
 
	handleEvent : function(aEvent) 
	{
		switch(aEvent.type)
		{
			default:
				break;

			case 'mouseup':
				this.finish(aEvent);
				this.startX = -1;
				this.startY = -1;
				window.setTimeout('StrokeService.preventToSendClickEvent = false', 10);
				break;

			case 'mousedown':
				if (this.startX < 0) {
					this.startX = aEvent.clientX;
					this.startY = aEvent.clientY;
				}
				break;

			case 'mousemove':
				if (this.startX > -1 && !this.active) {
					if (Math.abs(this.startX-aEvent.clientX) > Math.abs(this.dragStartDelta) ||
						Math.abs(this.startY-aEvent.clientY) > Math.abs(this.dragStartDelta)) {
						this.start(aEvent, this.startX, this.startY);
						this.preventToSendClickEvent = true;
					}
				}
				else
					this.trace(aEvent);

				break;

			case 'PresentationRedraw':
			case 'resize':
				this.clear();
				break;

			case 'click':
				if (this.preventToSendClickEvent) {
					aEvent.stopPropagation();
					aEvent.preventDefault();
					this.preventToSendClickEvent = false;
				}
				else if (this.cliclableNodesManager && this.cliclableNodesManager.clickableNodes) {
					var nodes = this.cliclableNodesManager.clickableNodes;
					var max = nodes.length;
					var x, y, width, height
					for (var i = 0; i < max; i++)
					{
						if (nodes[i].boxObject) {
							x      = nodes[i].boxObject.x;
							y      = nodes[i].boxObject.y;
							width  = nodes[i].boxObject.width;
							height = nodes[i].boxObject.height;
						}
						else {
							x      = nodes[i].offsetLeft;
							y      = nodes[i].offsetTop;
							width  = nodes[i].offsetWidth;
							height = nodes[i].offsetHeight;
						}
						if (aEvent.clientX < x ||
							aEvent.clientX > x+width ||
							aEvent.clientY < y ||
							aEvent.clientY > y+height)
							continue;

						var event = document.createEvent('MouseEvents');
						event.initMouseEvent(
							aEvent.type, aEvent.canBubble, aEvent.cancelable, aEvent.view,
							aEvent.detail,
							aEvent.screenX, aEvent.screenY, aEvent.clientX, aEvent.clientY,
							aEvent.ctrlKey, aEvent.altKey, aEvent.shiftKey, aEvent.metaKey,
							aEvent.button,
							aEvent.relatedTarget
						);
						nodes[i].dispatchEvent(event);
						break;
					}
				}
				break;
		}
	},
	preventToSendClickEvent : false,
 
	start : function(aEvent, aX, aY) 
	{
		this.active = true;
		this.trace(aEvent, aX, aY);
	},
 
	finish : function(aEvent) 
	{
		if (!this.active) return;
		this.trace(aEvent);
		this.finishStroke();
	},
 
	trace : function(aEvent, aX, aY) 
	{
		if (!this.active) return;
		this.addPoint((aX === void(0) ? aEvent.clientX : aX ), (aY === void(0) ? aEvent.clientY : aY ));
	},
 
	finishStroke : function() 
	{
		this.active = false;
		this.lastX = -1;
		this.lastY = -1;
	},
 
	addPoint : function(aX, aY) 
	{
		if (this.lastX != -1)
			this.drawLine(this.lastX, this.lastY, aX, aY);
		else
			this.drawDot(aX, aY);

		this.lastX = aX;
		this.lastY = aY;
	},
 
	clear : function() 
	{
		this.active = false;
		this.lastX = -1;
		this.lastY = -1;

		if (this.mode == 'canvas') {
			if (this.canvasElement.lastWindowWidth != window.innerWidth ||
				this.canvasElement.lastWindowHeight != window.innerHeight) {
				this.canvasElement.width  = this.canvasElement.parentNode.boxObject.width-2;
				this.canvasElement.height = this.canvasElement.parentNode.boxObject.height-2;

				this.canvasElement.lastWindowWidth  = window.innerWidth;
				this.canvasElement.lastWindowHeight = window.innerHeight;
			}
			this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
			this.canvasContext.strokeStyle = this.lineColor;
			this.canvasContext.lineWidth   = this.lineWidth;
		}
		else {
			var dotes = this.canvasElement.getElementsByAttribute('class', this.className);
			if (!dotes.length) return;

			var range = document.createRange();
			range.selectNodeContents(this.canvasElement);
			range.setStartBefore(dotes[0]);
			range.setEndAfter(dotes[dotes.length-1]);
			range.deleteContents();
			range.detach();
		}
	},
 
	drawDot : function(aX, aY, aParent) 
	{
		if (this.mode == 'canvas') {
			this.canvasContext.strokeRect(aX, aY, 0, 0);
			this.canvasContext.stroke();
		}
		else {
			var dot = document.createElement('spacer');
			dot.setAttribute('style', 'left:'+aX+'px; top:'+aY+'px');
			dot.setAttribute('class', this.className);
			(aParent || this.canvasElement).appendChild(dot);
		}
	},
 
	drawLine : function(aX1, aY1, aX2, aY2) 
	{
		if (aX1 == aX2 && aY1 == aY2) return;


		if (this.mode == 'canvas') {
			this.canvasContext.beginPath();
			this.canvasContext.moveTo(aX1, aY1);
			this.canvasContext.lineTo(aX2, aY2);
/*
			this.canvasContext.bezierCurveTo(
				parseInt(aX1+((aX2-this.lastX)*0.3)), parseInt(aY1+((aY2-this.lastY)*0.3)),
				parseInt(aX1+((aX2-this.lastX)*0.6)), parseInt(aY1+((aY2-this.lastY)*0.6)),
				aX2, aY2
			);
*/
			this.canvasContext.closePath();
			this.canvasContext.stroke();
		}
		else {
			var x_move = aX2 - aX1;
			var y_move = aY2 - aY1;
			var x_diff = x_move < 0 ? 1 : -1;
			var y_diff = y_move < 0 ? 1 : -1;

			var fragment = document.createDocumentFragment();
			if (Math.abs(x_move) >= Math.abs(y_move)) {
				for (var i = x_move; i != 0; i += x_diff)
					this.drawDot(aX2 - i, aY2 - Math.round(y_move * i / x_move), fragment);
			}
			else {
				for (var i = y_move; i != 0; i += y_diff)
					this.drawDot(aX2 - Math.round(x_move * i / y_move), aY2 - i, fragment);
			}
			this.canvasElement.appendChild(fragment);
		}
	}
 
}; 
  
var StrokablePresentationService = { 
	
	id : 'stroke-canvas-box', 

	strokeService         : null,
	cliclableNodesManager : null,
	canvasContainer       : null,
	canvas                : null,

	autoStart : false,
 
	init : function(aPresentation, aStrokeService) 
	{
		this.cliclableNodesManager = aPresentation;
		this.strokeService         = aStrokeService;
		this.canvasContainer       = document.getElementById('canvas').firstChild;
		this.check = document.getElementById('penButton');

		document.documentElement.addEventListener('StartDragOnCanvas', this, false);
		document.documentElement.addEventListener('PresentationRedraw', this, false);
	},
 
	toggle : function(aEnable) 
	{
		if (aEnable)
			this.start();
		else
			this.end();
	},
 
	start : function() 
	{
		if (!this.strokeService || !this.canvasContainer) return;

		this.strokeService.cliclableNodesManager = this.cliclableNodesManager;
		var box = document.createElement('vbox');
		box.setAttribute('flex', 1);
		box.setAttribute('id', this.id);
		box.style.width = this.canvasContainer.boxObject.width+'px';
		box.style.height = this.canvasContainer.boxObject.height+'px';
		this.canvas = this.canvasContainer.appendChild(box);
		this.strokeService.init(this.canvas);

		this.canvas.addEventListener('dblclick', this, false);
	},
 
	end : function() 
	{
		this.strokeService.destroy();
		if (this.canvas) {
			this.canvas.removeEventListener('dblclick', this, false);
			this.canvasContainer.removeChild(this.canvas);
			this.canvas = null;
		}
	},
 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			default:
				break;

			case 'StartDragOnCanvas':
				if (!this.check.checked) {
					this.toggleCheck();
					this.strokeService.startX = Presentation.dragStartX;
					this.strokeService.startY = Presentation.dragStartY;

					this.autoStart = true;
				}
				break;

			case 'PresentationRedraw':
				if (this.autoStart && this.check.checked) {
					this.autoStart = false;
					this.toggleCheck();
				}
				break;

			case 'dblclick':
				if (this.canvas)
					this.end();
				break;
		}
	},
 
	toggleCheck : function() 
	{
		var enable = !this.check.checked;
		this.toggle(enable);
		this.check.checked = enable;

		this.autoStart = false;
	}
 
}; 
  
function init() 
{
	window.removeEventListener('load', init, false);

	Presentation.init();
	StrokablePresentationService.init(Presentation, StrokeService);
}
window.addEventListener('load', init, false);
 
function getNodesByXPath(aExpression, aContext, aLive) 
{
	var d = aContext.ownerDocument || aContext;
	var type = aLive ? XPathResult.ORDERED_NODE_ITERATOR_TYPE : XPathResult.ORDERED_NODE_SNAPSHOT_TYPE ;
	var nodes;
	try {
		nodes = d.evaluate(aExpression, aContext, null, type, null);
	}
	catch(e) {
		nodes = document.evaluate(aExpression, aContext, null, type, null);
	}
	return nodes;
}
 
function insertXMLTo(aXML, aParent, aRefNode)
{
	var range = aParent.ownerDocument.createRange();
	range.selectNodeContents(aParent);
	if (aRefNode && aRefNode.parentNode == aParent) {
		range.setStartBefore(aRefNode);
		range.setEndBefore(aRefNode);
	}
	var fragment = range.createContextualFragment(aXML);
	// clear white-space nodes from XUL tree
	(function(aNode) {
		Array.slice(aNode.childNodes).forEach(arguments.callee);
		if (aNode.parentNode &&
			aNode.parentNode.namespaceURI == XULNS &&
			aNode.nodeType == Node.TEXT_NODE &&
			aNode.nodeValue.replace(/^\s+|\s+$/g, '') == '')
			aNode.parentNode.removeChild(aNode);
	})(fragment);
	range.insertNode(fragment);
	range.detach();
}
 

