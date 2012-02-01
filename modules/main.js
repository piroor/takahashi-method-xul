load('lib/WindowManager');
load('lib/ToolbarItem');

const TYPE_BROWSER = 'navigator:browser';
function handleWindow(aWindow)
{
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	ToolbarItem.create(<>
		<toolbarbutton id="restartless-takahashi-method-xul"
			oncommand="">
			<label value="Start Presentation"/>
		</toolbarbutton>
	</>, doc.getElementById('nav-bar'));
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown()
{
	WindowManager = undefined;
	ToolbarItem = undefined;
}
