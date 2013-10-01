load('lib/WindowManager');
load('lib/ToolbarItem');
load('lib/here');

var userData = resolve('../content/data/data.txt');
var data = exists(userData) ? userData : '' ;

const TYPE_BROWSER = 'navigator:browser';
function handleWindow(aWindow)
{
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	ToolbarItem.create(here(/*
		<toolbarbutton id="restartless-takahashi-method-xul"
			takahashi-data="%DATA%"
			oncommand="gBrowser.selectedTab = gBrowser.addTab('chrome://takahashi-method-xul-restartless/content/takahashi.xul?data='+this.getAttribute('takahashi-data'))">
			<label value="Start Presentation"/>
		</toolbarbutton>
	*/).replace(/%DATA%/g, data), doc.getElementById('nav-bar'));
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown()
{
	WindowManager = undefined;
	ToolbarItem = undefined;
}
