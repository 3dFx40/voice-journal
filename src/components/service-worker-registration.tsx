"use client";

import { useEffect } from "react";

let refreshedForServiceWorkerUpdate = false;

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const canRegister =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!canRegister) {
      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          void registration.update();

          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (!installingWorker) {
              return;
            }

            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                installingWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
        // PWA support should never block the journal UI.
      });
    };

    const reloadAfterControllerChange = () => {
      if (refreshedForServiceWorkerUpdate) {
        return;
      }

      refreshedForServiceWorkerUpdate = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      reloadAfterControllerChange
    );
    window.addEventListener("load", register);
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        reloadAfterControllerChange
      );
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
