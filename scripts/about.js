/** Fenêtre d'information du module, sans effet sur l'état de la partie. */
import { MODULE_ID } from "./constants.js";
import { localize } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EvilTenCandlesRollAbout extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "evil-tencandles-roll-about",
    classes: ["etcr-about"],
    tag: "section",
    position: { width: 465, height: "auto" },
    window: { resizable: false, icon: "fa-solid fa-circle-info" }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/about.hbs` }
  };

  get title() { return localize("About.Title"); }

  static open() {
    const existing = [...this.instances()].find((app) => app.rendered);
    if (existing) {
      existing.bringToFront();
      return existing;
    }
    const app = new this();
    void app.render(true);
    return app;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const packageData = game.modules.get(MODULE_ID);
    return {
      ...context,
      moduleName: packageData?.title ?? "Evilbram Ten Candles Roll",
      moduleVersion: packageData?.version ?? "",
      repositoryUrl: packageData?.url?.startsWith("https://github.com/")
        ? packageData.url
        : null,
      systemUrl: "https://foundryvtt.com/packages/tencandles-ga",
      coffeeUrl: "https://ko-fi.com/evilbram"
    };
  }
}

/** Entrée de menu accessible aux joueurs dans l'onglet Paramètres de V14. */
export function mountAboutInSettings(_app, element) {
  if (!(element instanceof HTMLElement)) return;
  if (element.querySelector(".etcr-about-settings-entry")) return;

  const target = element.querySelector(".settings-sidebar")
    ?? element.querySelector(".tab")
    ?? element;
  const section = document.createElement("section");
  section.className = "etcr-about-settings-entry";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "etcr-about-settings-button";

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-circle-info";
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "etcr-about-settings-label";
  label.textContent = localize("About.SidebarEntry");

  button.append(icon, label);
  button.addEventListener("click", () => EvilTenCandlesRollAbout.open());
  section.append(button);
  target.append(section);
}
