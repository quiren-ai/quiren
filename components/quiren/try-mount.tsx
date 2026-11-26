"use client";

import { useEffect } from "react";

/** Starts the /try simulation (public/try/app.js, the engine forked from Nexorum) and stops it on leave. */
export function TryMount() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    import(/* webpackIgnore: true */ "/try/app.js" as string)
      .then((m: { mount: () => () => void }) => {
        if (!gone) stop = m.mount();
      })
      .catch(() => {
        const b = document.getElementById("banner");
        if (b) b.textContent = "The simulation could not start. Reload the page to try again.";
      });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return null;
}
