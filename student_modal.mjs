let activeDialog = null;

function closeActiveDialog(value) {
  if (!activeDialog) return;
  const { overlay, resolve } = activeDialog;
  activeDialog = null;
  overlay.remove();
  resolve(value);
}

export function openStudentDialog({
  title,
  message = "",
  choices = [],
  confirmLabel = "決定",
  cancelLabel = "キャンセル",
  notice = false,
} = {}) {
  if (activeDialog) closeActiveDialog(null);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "student-modal-overlay";
    overlay.innerHTML = `
      <section class="student-modal" role="dialog" aria-modal="true" aria-labelledby="studentModalTitle">
        <div class="student-modal-handle" aria-hidden="true"></div>
        <h2 id="studentModalTitle" class="student-modal-title"></h2>
        <p class="student-modal-message"></p>
        <div class="student-modal-choices" ${choices.length ? "" : "hidden"}></div>
        <div class="student-modal-actions">
          <button type="button" class="btn student-modal-cancel" ${notice ? "hidden" : ""}></button>
          <button type="button" class="btn btn-primary student-modal-confirm"></button>
        </div>
      </section>`;

    const titleNode = overlay.querySelector(".student-modal-title");
    const messageNode = overlay.querySelector(".student-modal-message");
    const choicesNode = overlay.querySelector(".student-modal-choices");
    const cancelButton = overlay.querySelector(".student-modal-cancel");
    const confirmButton = overlay.querySelector(".student-modal-confirm");
    titleNode.textContent = String(title || "確認");
    messageNode.textContent = String(message || "");
    messageNode.hidden = !message;
    cancelButton.textContent = cancelLabel;
    confirmButton.textContent = confirmLabel;

    let selectedValue = null;
    if (choices.length) {
      confirmButton.disabled = true;
      for (const choice of choices) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "student-modal-choice";
        button.textContent = String(choice.label || choice.value || "");
        button.dataset.value = String(choice.value ?? "");
        button.addEventListener("click", () => {
          selectedValue = button.dataset.value;
          choicesNode.querySelectorAll(".student-modal-choice").forEach((item) => {
            const selected = item === button;
            item.classList.toggle("is-selected", selected);
            item.setAttribute("aria-pressed", selected ? "true" : "false");
          });
          confirmButton.disabled = false;
        });
        button.setAttribute("aria-pressed", "false");
        choicesNode.append(button);
      }
    }

    activeDialog = { overlay, resolve };
    cancelButton.addEventListener("click", () => closeActiveDialog(null));
    confirmButton.addEventListener("click", () => {
      closeActiveDialog(choices.length ? selectedValue : true);
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && !notice) closeActiveDialog(null);
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && activeDialog?.overlay === overlay && !notice) {
          closeActiveDialog(null);
        }
      },
      { once: true },
    );
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    (choices.length ? choicesNode.querySelector("button") : confirmButton)?.focus();
  });
}

export async function confirmStudentDialog(options) {
  return (await openStudentDialog(options)) === true;
}

export async function showStudentNotice(title, message = "") {
  await openStudentDialog({
    title,
    message,
    confirmLabel: "閉じる",
    notice: true,
  });
}
