/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

Components.utils.import("chrome://otpmail/content/otpcommon.js");

//addEventListener('messagepane-loaded', msgHdrViewLoad, true);

var prefs = null;
var i = 2;
function optionsInitialize()
{	
	if (window.arguments && window.arguments[0])
	{
		document.getElementById('prefTabs').selectedIndex = window.arguments[0];
	}

	prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService)
		.getBranch("extensions.otpmail.");

	document.getElementById('otpjar').value = prefs.getCharPref("otpjar");
	document.getElementById('keydir').value = prefs.getCharPref("keydir");
	document.getElementById('javaexe').value = prefs.getCharPref("javaexe");

	document.getElementById('cbcache').checked = prefs.getBoolPref("cachephrase");
	document.getElementById('cbsubject').checked = prefs.getBoolPref("subjectwarning");
	document.getElementById('cbhtml').checked = prefs.getBoolPref("htmlwarning");
}

function optionsSave()
{
	prefs.setCharPref("otpjar", document.getElementById('otpjar').value);
	prefs.setCharPref("keydir", document.getElementById('keydir').value);
	prefs.setCharPref("javaexe", document.getElementById('javaexe').value);

	prefs.clearUserPref("cachephrase");
	prefs.setBoolPref("cachephrase", document.getElementById('cbcache').checked);
	prefs.clearUserPref("subjectwarning");
	prefs.setBoolPref("subjectwarning", document.getElementById('cbsubject').checked);
	prefs.clearUserPref("htmlwarning");
	prefs.setBoolPref("htmlwarning", document.getElementById('cbhtml').checked);
}

function selectJarPath()
{
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Select OTP.jar", nsIFilePicker.modeOpen);
	fp.appendFilter("Jar Files","*.jar");
	fp.appendFilters(nsIFilePicker.filterAll);

	var lf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

	try
	{
		lf.initWithPath(document.getElementById('otpjar').value);
		fp.displayDirectory = lf.parent;
	}
	catch (ex)
	{
	}

	if (fp.show() == nsIFilePicker.returnOK)
	{
		document.getElementById('otpjar').value = fp.file.path;
	}
}

function selectKeyPath()
{
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Select key directory", nsIFilePicker.modeGetFolder);

	var lf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	try
	{
		lf.initWithPath(document.getElementById('keydir').value);
		fp.displayDirectory = lf;
	}
	catch (ex)
	{
	}
	
	if (fp.show() == nsIFilePicker.returnOK)
	{
		document.getElementById('keydir').value = fp.file.path;
	}
}


function selectJavaPath()
{
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, "Select Java executable", nsIFilePicker.modeOpen);

	var lf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	fp.appendFilters(nsIFilePicker.filterAll);
	fp.appendFilter("EXE Files","*.exe");

	try
	{
		lf.initWithPath(document.getElementById('javaexe').value);
		fp.displayDirectory = lf.parent;
	}
	catch (ex)
	{
	}
	
	if (fp.show() == nsIFilePicker.returnOK)
	{
		document.getElementById('javaexe').value = fp.file.path;
	}
}
