(function () {
  "use strict";

  var tokenPattern = /^[A-Za-z0-9_-]{43}$/;
  var query = new URLSearchParams(window.location.search);
  var tokens = query.getAll("token");
  var token = window.location.pathname === "/invite/" && tokens.length === 1
    ? tokens[0]
    : null;
  var title = document.getElementById("invite-title");
  var message = document.getElementById("invite-message");
  var playLink = document.getElementById("invite-play-link");
  var fallbackLink = document.getElementById("invite-fallback-link");

  if (!tokenPattern.test(token || "")) {
    title.textContent = "This invitation link is not valid.";
    message.textContent = "Ask the person who invited you to create a new Fitandem invitation.";
    playLink.hidden = true;
    document.querySelector(".invite-fallback").innerHTML = '<a href="/">Return to the Fitandem home page</a>.';
    document.querySelector(".invite-privacy").hidden = true;
    return;
  }

  title.textContent = "You’ve been invited to join a Tandem.";
  message.textContent = "Install or open Fitandem to review the invitation. You will always confirm before joining.";

  var referrer = new URLSearchParams({token: token}).toString();
  var playUrl = new URL("https://play.google.com/store/apps/details");
  playUrl.searchParams.set("id", "uk.co.dkhiggins.fitandem");
  playUrl.searchParams.set("referrer", referrer);
  playLink.href = playUrl.toString();
  fallbackLink.href = playUrl.toString();
}());
