/** Pair: pages/membership.html */
import { text } from "../html.js";

export function fill(root, ctx) {
    const plan = ctx.me?.plan || "Classic";
    text(root, "[data-current-plan]", plan);
    root.querySelectorAll(".tier-card").forEach((card) => {
        const id = card.dataset.tier;
        const on = id === plan;
        card.classList.toggle("is-current", on);
        const chip = card.querySelector(".label-chip");
        if (chip) chip.textContent = on ? "Current" : id;
        const cta = card.querySelector(".tier-cta");
        if (!cta) return;
        cta.classList.toggle("ghost", on);
        if (on) cta.textContent = "Your plan";
    });
}

export function bind(root) {
    const apply = (yearly) => {
        root.querySelectorAll("[data-billing]").forEach((btn) => {
            btn.classList.toggle("active", (btn.dataset.billing === "year") === yearly);
        });
        root.querySelectorAll("[data-price-month]").forEach((el) => {
            el.textContent = yearly ? el.dataset.priceYear : el.dataset.priceMonth;
        });
        root.querySelectorAll("[data-price-period]").forEach((el) => {
            el.textContent = yearly ? "/ year" : "/ month";
        });
        root.querySelectorAll(".tier-cta[data-plan]").forEach((btn) => {
            if (btn.classList.contains("ghost")) return;
            const card = btn.closest(".tier-card");
            const amount = card?.querySelector("[data-price-month]");
            if (!amount) return;
            const plan = btn.dataset.plan;
            const price = yearly ? amount.dataset.priceYear : amount.dataset.priceMonth;
            btn.textContent = `Choose ${plan} · $${price}`;
        });
    };
    root.querySelectorAll("[data-billing]").forEach((btn) => {
        btn.addEventListener("click", () => apply(btn.dataset.billing === "year"));
    });
    return () => {};
}
