/*
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 */

Components.utils.import("chrome://otpmail/content/otpcommon.js");
var returnValue;

function multilineInit()
{	
	if (window.arguments && window.arguments[2])
	{
		document.getElementById('otpMultiline').title = window.arguments[0];
		document.getElementById('multilineCaption').value = window.arguments[1];
		returnValue = window.arguments[2];
	}
	if (window.arguments[3])
		document.getElementById('multilineInput').value = window.arguments[3];
}

function multilineOK()
{
	returnValue.value = document.getElementById('multilineInput').value;
}
