/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

var Cc = Components.classes;
var Ci = Components.interfaces;
var w1 = null;

var msgHdr = null;

var divider1 = "-----BEGIN OTP MESSAGE-----";
var divider2 = "-----END OTP MESSAGE-----";
	
Components.utils.import("resource:///modules/gloda/index_msg.js");
Components.utils.import("resource:///modules/gloda/mimemsg.js");
// This is Thunderbird 3.3 only!
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

Components.utils.import("chrome://otpmail/content/otpcommon.js");
Components.utils.import("resource://otpmail/subprocess.jsm");

var listener =
{
	onStartHeaders: function _listener_onStartHeaders ()
	{
		var msgFrame = otpCommon.getFrame(window, "messagepane");

		if (msgFrame)
		{
			//msgFrame.addEventListener("unload", messageUnload, true);
			msgFrame.addEventListener("load", decryptMessage, false);
		}
	},
	onEndHeaders: function () {},
	onEndAttachments: function () {}
};

gMessageListeners.push(listener);
checkFirstrun();

var ctr = 0;

function buttonNewkey()
{
	ctr++;
	window.openDialog("chrome://otpmail/content/newkeywizard.xul", "otpNewKey-"+ctr, "centerscreen,chrome,close,titlebar");
}

function buttonSetup()
{
	window.openDialog("chrome://otpmail/content/setupwindow.xul", "otpSetup", "centerscreen,chrome,close,titlebar");
}


function menuNewkey()
{
	ctr++;
	window.openDialog("chrome://otpmail/content/newkeywizard.xul", "otpNewKey-"+ctr, "centerscreen,chrome,close,titlebar");
}

function menuImport()
{
	ctr++;
	window.openDialog("chrome://otpmail/content/importwizard.xul", "otpImport-"+ctr, "centerscreen,chrome,close,titlebar");
}

function menuExport()
{
	ctr++;
	window.openDialog("chrome://otpmail/content/exportwizard.xul", "otpExport-"+ctr, "centerscreen,chrome,close,titlebar");
}

function menuKeyinfo()
{
	ctr++;
	window.openDialog("chrome://otpmail/content/keyinfowindow.xul", "otpInfo-"+ctr, "centerscreen,chrome,close,titlebar");
}

function menuClearPdw()
{
	otpCommon.clearPassphrase();
}

function menuSetup()
{
	window.openDialog("chrome://otpmail/content/setupwindow.xul", "otpSetup", "centerscreen,chrome,close,titlebar", 0);
}

function menuAbout()
{
	window.openDialog("chrome://otpmail/content/setupwindow.xul", "otpNewKey", "centerscreen,chrome,close,titlebar", 1);
}

function checkFirstrun()
{
	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.otpmail.");
	var ok = false;

	try
	{
		if (prefs.getCharPref("otpjar").length > 0 &&
		prefs.getCharPref("keydir").length > 0 &&
		prefs.getCharPref("javaexe").length > 0)
			ok = true;
	}
	catch (ex)
	{
	}

	if (!ok)
	{
		//var yn = otpCommon.msgBox(otpCommon.msgboxYEYNO, "OTPmail first run", "It looks like you run OTPmail for the first time. In order to work, you have to set up some paths. Do you want to do that now?");
		alert("It looks like you run OTPmail for the first time. In order to work, you have to set up some paths...");
		window.openDialog("chrome://otpmail/content/setupwindow.xul", "otpSetup", "centerscreen,chrome,close,titlebar");
	}
}

function menuDenyMessage()
{
	var w = window;
	var dMsgHdr = gFolderDisplay.selectedMessage;
	if (dMsgHdr!=null)
	{
		MsgHdrToMimeMessage(dMsgHdr, null, function(aMsgHdr, aMimeMsg)
		{
			var msgText = aMimeMsg.prettyString(true, undefined, true);

			if (msgText.indexOf(divider1)<0)
			{
				otpCommon.msgBox(otpCommon.msgboxERR, "Error", "Sorry, only OTP encrypted mails can be denied.");
				return;
			}

			var start = msgText.indexOf(divider1);
			var end = msgText.indexOf(divider2, start);
			var crypt = msgText.substring(start, end + divider2.length);
			var again = true;
			var options = {};
			options.window = w;
			var newText = "";
			while (again)
			{
				again = false;
				options.text = newText;
				newText = otpCommon.msgBox(otpCommon.msgboxMULTILINE, "New Message Text", "Please enter the new message text:", options);
				if (newText != null)
				{
					try
					{
						otpCommon.denyText(crypt, newText);
						otpCommon.msgBox(otpCommon.msgboxOK, "Key modified", "The key was modified successfully.\n");
					}
					catch (ex)
					{
						otpCommon.msgBox(otpCommon.msgboxERR, "Key modification error", "Key modification error:\n" + ex.message);
						if (ex.code == 6)
							again = true;
					}
				}
			}
		}, true, { examineEncryptedParts: true });
	}
	else
			otpCommon.msgBox(otpCommon.msgboxERR, "Error", "Please select an OTP encrypted mail first.");

}

function decryptMessage()
{
	var dMsgHdr = gFolderDisplay.selectedMessage;
	if (dMsgHdr!=null)
		MsgHdrToMimeMessage(dMsgHdr, null, decryptMsgCallback, true, { examineEncryptedParts: true });
}

// based on Enigmail enigmailMessengerOverlay.js / messageParse / 751 & messageParseCallback / 844
function decryptMsgCallback(aMsgHdr, aMsgMime)
{
	var msgFrame = otpCommon.getFrame(window, "messagepane");
	var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

	var msgText = bodyElement.textContent;

	if (!msgText)
		return;

	if (msgText.indexOf(divider1)<0)
		return;

	dump("Decrypting OTP message...\n");

	var start = msgText.indexOf(divider1);
	var end = msgText.indexOf(divider2, start);

	var before = msgText.substring(0, start);
	var crypt = msgText.substring(start, end + divider2.length);
	var after = msgText.substring(end + divider2.length, msgText.length);

	var decrypt;
	var decrypted;

	try
	{
		decrypt = otpCommon.decryptText(crypt);
		decrypted = decrypt!=null;
	}
	catch (ex)
	{
		if (ex.code > 0)
		{
			// message
			if (ex.code == 1)
			{
				otpCommon.msgBox(otpCommon.msgboxOK, "Decryption message", ex.message);
			}
			// own key out of sync
			else if (ex.code == 4)
			{
				otpCommon.msgBox(otpCommon.msgboxERR, "Your key is out of date", "This key's data is out of date. Maybe you imported an older key or put back a backup file.\nTo prevent insecure messages, it has be deactivated for all following encryption functions.\nTo reacticate it, create a reply message and seect 'Generate synchronisation request' from the composing OTPmail menu.");
				// DEBUG...
				//uri = aMsgHdr.folder.getUriForMsg(aMsgHdr);
				//ComposeMessage(Ci.nsIMsgCompType.ReplyToSender, Ci.nsIMsgCompFormat.PlainText, aMsgHdr.folder, [uri]);
				// see also https://developer.mozilla.org/en/Extensions/Thunderbird/HowTos/Common_Thunderbird_Use_Cases/Compose_New_Message
				// ...DEBUG
			}
			// partner out of sync
			else if (ex.code == 5)
			{
				otpCommon.msgBox(otpCommon.msgboxERR, "The senders key is out of date", "The senders key's data is out of date. To prevent insecure messages you should send a synchronisation message as soon as possible.\nTo do so, please create a reply message and select 'Generate synchronisation message' from the composing OTPmail menu.");
			}
			// all other errors
			else
				otpCommon.msgBox(otpCommon.msgboxERR, "Decryption error", "Decryption error:\n" + ex.message);
		}
		decrypted = false;
	}

	if (decrypted)
	{
		try
		{
			var unicodeConv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].getService(Components.interfaces.nsIScriptableUnicodeConverter);
			unicodeConv.charset = "utf-8";
			decrypt = unicodeConv.ConvertToUnicode(decrypt);
		}
		catch(ex)
		{
		}
		
		var newText = before + decrypt + after;
		var foundIndex = -1;
		var findStr = "-----BEGIN OTP";

		if (bodyElement.firstChild)
		{
			var node = bodyElement.firstChild;
			while (node)
			{
				if (node.nodeName == "DIV")
				{
					foundIndex = node.textContent.indexOf(findStr);

					if (foundIndex >= 0)
					{
						node.innerHTML = formatPlaintextMsg(newText);
						return;
					}
				}
				node = node.nextSibling;
			}
		}
		otpCommon.msgBox(otpCommon.msgboxERR, "Decryption error", "Decryption error:\nCould not replace text.");
	}
}

// based on Enigmail commonfunc.jsm / formatPlaintextMsg / 640
function formatPlaintextMsg(plainTxt)
{
	//if (! gTxtConverter)
	var gTxtConverter = Cc["@mozilla.org/txttohtmlconv;1"].createInstance(Ci.mozITXTToHTMLConv);

	var prefRoot = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch(null);

	var fontStyle = "";

	// set the style stuff according to perferences

	switch (prefRoot.getIntPref("mail.quoted_style"))
	{
		case 1:
			fontStyle="font-weight: bold; "; break;
		case 2:
			fontStyle="font-style: italic; "; break;
		case 3:
			fontStyle="font-weight: bold; font-style: italic; "; break;
	}

	switch (prefRoot.getIntPref("mail.quoted_size"))
	{
		case 1:
			fontStyle += "font-size: large; "; break;
		case 2:
			fontStyle += "font-size: small; "; break;
	}

	fontStyle += "color: "+prefRoot.getCharPref("mail.citation_color")+";";

	var convFlags = Ci.mozITXTToHTMLConv.kURLs;
	if (prefRoot.getBoolPref("mail.display_glyph"))
	    convFlags |= Ci.mozITXTToHTMLConv.kGlyphSubstitution;
	if (prefRoot.getBoolPref("mail.display_struct"))
	    convFlags |= Ci.mozITXTToHTMLConv.kStructPhrase;

	// start processing the message

	plainTxt = plainTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	var lines = plainTxt.split(/\n/);
	var oldCiteLevel = 0;
	var citeLevel = 0;
	var preface = "";
	var logLineStart = { value: 0 };
	var isSignature = false;

	for (var i=0; i < lines.length; i++)
	{
		preface = "";
		oldCiteLevel = citeLevel;
		if (lines[i].search(/^[\> \t]*\>$/) == 0)
			lines[i]+=" ";

		citeLevel = gTxtConverter.citeLevelTXT(lines[i], logLineStart);

		if (citeLevel > oldCiteLevel)
		{

			preface='</pre>';
			for (let j=0; j < citeLevel - oldCiteLevel; j++)
			{
				preface += '<blockquote type="cite" style="'+fontStyle+'">';
			}
			preface += '<pre wrap="">';
		}
		else if (citeLevel < oldCiteLevel)
		{
			preface='</pre>';
			for (let j = 0; j < oldCiteLevel - citeLevel; j++)
				preface += "</blockquote>";

			preface += '<pre wrap="">';
		}

		if (logLineStart.value > 0)
		{
			preface += '<span class="moz-txt-citetags">' +
					gTxtConverter.scanTXT(lines[i].substr(0, logLineStart.value), convFlags) +
					'</span>';
		}
		else if (lines[i] == "-- ")
		{
			preface+='<div class=\"moz-txt-sig\">';
			isSignature = true;
		}
		lines[i] = preface + gTxtConverter.scanTXT(lines[i].substr(logLineStart.value), convFlags);

	}

	var r='<pre wrap="">' + lines.join("\n") + (isSignature ? '</div>': '') + '</pre>';
	return r;
}

