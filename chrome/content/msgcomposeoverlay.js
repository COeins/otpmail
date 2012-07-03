/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

Components.utils.import("chrome://otpmail/content/otpcommon.js");
var encryptMode = false;
var encrypted = false;
var syncmsg = false;
var originalText = null;


// defining and registering various listeners...

var composeStateListener = 
{
	NotifyComposeFieldsReady: function() { },
	
	NotifyComposeBodyReady:function()
	{
		// Check for OTP encrypted text
		var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
		var flags = Components.interfaces.nsIDocumentEncoder.OutputFormatted
			|	Components.interfaces.nsIDocumentEncoder.OutputLFLineBreak;
		var text = editor.outputToString("text/plain", flags);

		var divider1 = "-----BEGIN OTP MESSAGE-----";
		var divider2 = "-----END OTP MESSAGE-----";
		var replacement = "[OTP ENCRYPTED TEXT]";

		if (text.indexOf(divider1)<0)
			return;

		var start = text.indexOf(divider1);
		var end = text.indexOf(divider2, start);

		var before = text.substring(0, start);
		var after = text.substring(end + divider2.length, text.length);

		var newtext = before + replacement +  after;
		replaceText(editor, newtext);
		editor.beginningOfDocument();
	},
	
	ComposeProcessDone: function(res)
	{
		if (res != Components.results.NS_OK && encrypted) 
		{
			// undo encryption
			var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
			replaceText(editor, originalText);
			encrypted = false;
		}	
	}
};

window.addEventListener('compose-send-message',
  function composeSendMsg_Listener (event)
  {
    composeSendMsg(event);
  },
  true)

window.addEventListener("load",
	function composeLoad_Listener (event)
	{
		composeWindowOpen(event);
	},
	false);

window.addEventListener("unload",
	function composeUnload_Listener (event)
	{
		composeWindowClose(event);
	},
	false);

// Handle recycled windows
window.addEventListener("compose-window-reopen",
	function msgComposeReopen_Listener (event)
	{
		composeWindowOpen(event);
	},
	true);

window.addEventListener("compose-window-close",
	function msgComposeClose_Listener (event)
	{
		composeWindowClose(event);
	},
	true);

function composeWindowOpen()
{
	gMsgCompose.RegisterStateListener(composeStateListener);
}

function composeWindowClose()
{
	originalText = null;
	encrypted = false;
	syncmsg = false;
	if (encryptMode)
		toggleEncryptMode();

	if (gMsgCompose)
		gMsgCompose.UnregisterStateListener(composeStateListener);
}

// window.addEventListener("compose-window-init",
// 	function msgComposeInit_Listener (event)
// 	{
//    gMsgCompose.RegisterStateListener(composeInitListener);
// 	},
// 	true);

// parts based on Enigmail enigmailMsgComposeOverlay.js / encryptMsg / 1250
function composeSendMsg(ev)
{
	if (!encryptMode)
		return;

	var msgcomposeWindow = document.getElementById("msgcomposeWindow");
	var msg_type = msgcomposeWindow.getAttribute("msgtype");
	
	// nsIMsgCompDeliverMode:
	//  Now (number) = "0"
	//  Later (number) = "1"
	//  Save (number) = "2"
	//  SaveAs (number) = "3"
	//  SaveAsDraft (number) = "4"
	//  SaveAsTemplate (number) = "5"
	//  SendUnsent (number) = "6"
	//  AutoSaveAsDraft (number) = "7"
	//  Background (number) = "8"
	if( !(msg_type == nsIMsgCompDeliverMode.Now || msg_type == nsIMsgCompDeliverMode.Later) )
		return;
	
	var really_send = true;
	
	// flags are declared in base/public/nsIDocumentEncoder.idl
	// OutputSelectionOnly = 1,         OutputFormatted = 2,
	// OutputRaw = 4,                   OutputBodyOnly = 8,
	// OutputPreformatted = 16,         OutputWrap = 32,
	// OutputFormatFlowed = 64,         OutputAbsoluteLinks = 258,
	// OutputEncodeW3CEntities = 256,   OutputCRLineBreak = 512,
	// OutputLFLineBreak = 1024,        OutputNoScriptContent = 2048,
	// OutputNoFramesContent = 4096,    OutputNoFormattingePre = 8192,
	// OutputEncodeBasicEntities=16384, OutputEncodeLatin1Entities=32768,
	// OutputEncodeHTMLEntities=65536,  OutputPersistNBSP=131072
	var flags = Components.interfaces.nsIDocumentEncoder.OutputFormatted
	|	Components.interfaces.nsIDocumentEncoder.OutputLFLineBreak;

	var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
	var msgtext = editor.outputToString("text/plain", flags);

	var bucketList = document.getElementById("attachmentBucket");
	var hasAttachments = ((bucketList && bucketList.hasChildNodes()) || gMsgCompose.compFields.attachVCard);

	if (hasAttachments)
	{
		var yesno = otpCommon.msgBox(otpCommon.msgboxYESNO, "Warning", "The current version of OTPmail does not yet support encrypted attachments. Files should be encrypted before attaching or they will be sent in plaintext!\nDo you still want to continue?");
		if (yesno != true)
		{
			ev.preventDefault();
			ev.stopPropagation();
			return;
		}
	}

	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.otpmail.");
	var warnhtml = prefs.getBoolPref("htmlwarning");
	if (warnhtml && gMsgCompose.composeHTML)
	{
		var chckbx = otpCommon.msgBox(otpCommon.msgboxCHKBX, "Warning", "Encrypting HTML-formatted mails is not supported at this time. Your message will be converted to plain text.", "Do not disply this warning anymore");
		if (chckbx)
			prefs.setBoolPref("htmlwarning", false);
	}

	var warnsubj = prefs.getBoolPref("subjectwarning");
	if (warnsubj && gMsgCompose.compFields.subject.length > 0)
	{
		var chckbx = otpCommon.msgBox(otpCommon.msgboxCHKBX, "Warning", "The content of subject lines will never be encrypted. Anything you write here can be read by anyone intercepting this mail.", "Do not disply this warning anymore");
		if (chckbx)
			prefs.setBoolPref("subjectwarning", false);
	}

	// backup plaintext in cace of cancel
	originalText = msgtext;

	try
	{
		var msgnew = otpCommon.encryptText(msgtext);
	}
	catch (ex)
	{
		if (ex.code > 0)
		{
			if (ex.code == 4)
			{
				var r = otpCommon.msgBox(otpCommon.msgboxYESNO, "Your key is out of date", "This Key has been temporarily deactivated, because it is out of date. It can by beactivated by requesting a synchronisation from your partner.\nDo you want to generate a synchronisation request now?\n(Please backup your mail content before doing so.)");
				if (r == true)
					menuSyncReq();
			}
			else
				alert("Encryption error:\n" + ex.message);
		}
		really_send = false;
	}

	if (msgnew == null)
		really_send = false;

	if (really_send)
	{
		// conv to unicode? (enigmailcommon.jsm / 910)
		replaceText(editor, msgnew);
		encrypted = true;
	}
	else
	{
		ev.preventDefault();
		ev.stopPropagation();
	}
}

function menuSyncReq()
{
	if (syncmsg)
	{
		otpCommon.msgBox(otpCommon.msgboxOK, "Create sync error", "This message already contains a key synchronisation block.");
		return;
	}
	
	var flags = Components.interfaces.nsIDocumentEncoder.OutputFormatted
	|	Components.interfaces.nsIDocumentEncoder.OutputLFLineBreak;

	var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
	var msgtext = editor.outputToString("text/plain", flags);

	if (msgtext.trim().length > 0)
	{
		var ans = otpCommon.msgBox(otpCommon.msgboxYESNO, "Create sync request", "Synchronisation messages cannot contain any encrypted text. If you create a sync request now, your message text will be replaced. Do you want to continue?");
		if (ans == null || ans == false)
			return;
	}

	try
	{
		var message = otpCommon.manageKey("-a --quiet --request-sync");
		replaceText(editor, message);
		
		if (encryptMode)
			toggleEncryptMode();

		originalText = message;
		syncmsg = true;

		ans = otpCommon.msgBox(otpCommon.msgboxYESNO, "Create sync request", "Synchronisation request has been created. Do you want to send this mail now?\n(Choose 'no' to adjust recipient or subject line before sending)");
		if (ans == null || ans == false)
			return;

		goDoCommand('cmd_sendNow');
	}
	catch (ex)
	{
		if (ex.code > 0)
			alert("Synchronisation error:\n" + ex.message);
	}
}


function menuSyncAck()
{
	if (syncmsg)
	{
		otpCommon.msgBox(otpCommon.msgboxOK, "Create sync error", "This message already contains a key synchronisation block.");
		return;
	}

	var flags = Components.interfaces.nsIDocumentEncoder.OutputFormatted
	|	Components.interfaces.nsIDocumentEncoder.OutputLFLineBreak;

	var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
	var msgtext = editor.outputToString("text/plain", flags);

	if (msgtext.trim().length > 0)
	{
		var ans = otpCommon.msgBox(otpCommon.msgboxYESNO, "Create sync message", "Synchronisation messages cannot contain any encrypted text. If you create a sync message now, your message text will be replaced. Do you want to continue?");
		if (ans == null || ans == false)
			return;
	}

	try
	{
		var message = otpCommon.manageKey("-a --quiet --syncronize");
		replaceText(editor, message);
		
		if (encryptMode)
			toggleEncryptMode();

		originalText = message;
		syncmsg = true;

		ans = otpCommon.msgBox(otpCommon.msgboxYESNO, "Create sync message", "Synchronisation message has been created. Do you want to send this mail now?\n(Choose 'no' to adjust recipient or subject line before sending)");
		if (ans == null || ans == false)
			return;

		goDoCommand('cmd_sendNow');
	}
	catch (ex)
	{
		if (ex.code > 0)
			alert("Synchronisation error:\n" + ex.message);
	}
}

function replaceText(editor, text)
{
	editor.selectAll();
	editor.insertText("");
	editor.selectAll();
	editor.insertText(text);
}


function toggleEncryptMode(ev)
{
	if (syncmsg)
	{
		otpCommon.msgBox(otpCommon.msgboxOK, "Encryption error", "This message contains a key synchronisation block. It should not be encrypted again.");
		return;
	}

	encryptMode = !encryptMode;

	dump ("toggleEncryptMode: "+encryptMode+"\n");

	var menu = document.getElementById("menuOtpEnc");
	var button = document.getElementById("buttonOtpEnc");
	var status = document.getElementById("otpComposeStatus");

	if (menu)
		menu.setAttribute("checked", encryptMode);

	if (button)
		button.setAttribute("checked", encryptMode);

	if (status)
	{
		if (encryptMode)
			status.setAttribute("encrypt", "active");
		else
			status.removeAttribute("encrypt");
	}
}
