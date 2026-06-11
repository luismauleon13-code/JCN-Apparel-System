const API_URL = "http://localhost:5000";
const CUSTOM_PRICE = 499;

let currentColor = "#111111";
let currentView = "Front";
let savedDesign = null;

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();

  document.querySelectorAll(".color-btn").forEach(btn => {
    btn.addEventListener("click", () => changeColor(btn.dataset.color));
  });

  document.getElementById("customText").addEventListener("input", updateText);
  document.getElementById("logoUpload").addEventListener("change", uploadLogo);
  document.getElementById("frontBtn").addEventListener("click", () => changeView("Front"));
  document.getElementById("backBtn").addEventListener("click", () => changeView("Back"));
  document.getElementById("saveDesignBtn").addEventListener("click", saveDesign);
  document.getElementById("addCartBtn").addEventListener("click", addToCart);
  document.getElementById("logoutBtn").addEventListener("click", logoutCustomer);

  makeDraggable(document.getElementById("textLayer"));
  makeDraggable(document.getElementById("logoLayer"));
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
  }
}

function changeColor(color) {
  currentColor = color;
  document.getElementById("shirtModel").style.background = color;
}

function updateText() {
  document.getElementById("textLayer").textContent =
    document.getElementById("customText").value;
}

function uploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(event) {
    const logo = document.getElementById("logoLayer");
    logo.src = event.target.result;
    logo.style.display = "block";
  };

  reader.readAsDataURL(file);
}

function changeView(view) {
  currentView = view;
  document.getElementById("viewLabel").textContent = `${view} Preview`;

  if (view === "Back") {
    document.getElementById("textLayer").style.top = "180px";
    document.getElementById("textLayer").style.left = "90px";
    document.getElementById("logoLayer").style.top = "240px";
  } else {
    document.getElementById("textLayer").style.top = "150px";
    document.getElementById("textLayer").style.left = "80px";
    document.getElementById("logoLayer").style.top = "210px";
  }
}

function makeDraggable(element) {
  let offsetX = 0;
  let offsetY = 0;
  let isDown = false;

  element.addEventListener("mousedown", e => {
    isDown = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
  });

  document.addEventListener("mousemove", e => {
    if (!isDown) return;

    const parent = document.getElementById("shirtModel");
    const maxX = parent.offsetWidth - element.offsetWidth;
    const maxY = parent.offsetHeight - element.offsetHeight;

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });

  document.addEventListener("mouseup", () => {
    isDown = false;
  });
}

async function capturePreview() {
  const canvas = await html2canvas(document.getElementById("designArea"));
  return canvas.toDataURL("image/png");
}

async function saveDesign() {
  const confirmSave = confirm("Save custom design?");
  if (!confirmSave) return;

  const user = JSON.parse(localStorage.getItem("customerUser")) || {};
  const textLayer = document.getElementById("textLayer");
  const logoLayer = document.getElementById("logoLayer");

  const previewImage = await capturePreview();

  const designData = {
    user_id: user.id,
    apparel_type: document.getElementById("apparelType").value,
    color: currentColor,
    custom_text: document.getElementById("customText").value,
    text_position: {
      top: textLayer.style.top,
      left: textLayer.style.left
    },
    logo_image: logoLayer.src || "",
    logo_position: {
      top: logoLayer.style.top,
      left: logoLayer.style.left
    },
    preview_image: previewImage,
    price: CUSTOM_PRICE
  };

  try {
    const res = await fetch(`${API_URL}/api/custom-designs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(designData)
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to save design.");
      return;
    }

    savedDesign = {
      ...designData,
      id: data.design.id
    };

    alert("Design saved successfully.");

  } catch (error) {
    console.error(error);
    alert("Cannot connect to server.");
  }
}

async function addToCart() {
  if (!savedDesign) {
    const askSave = confirm("Design is not saved yet. Save now?");
    if (!askSave) return;

    await saveDesign();

    if (!savedDesign) return;
  }

  let cart = JSON.parse(localStorage.getItem("customerCart")) || [];
  const qty = Number(document.getElementById("quantityInput").value || 1);

  cart.push({
    cartKey: `custom-${Date.now()}`,
    product_id: savedDesign.id,
    title: `Custom ${savedDesign.apparel_type}`,
    image: savedDesign.preview_image,
    price: CUSTOM_PRICE,
    size: "Custom",
    color: savedDesign.color,
    quantity: qty,
    custom_design: savedDesign
  });

  localStorage.setItem("customerCart", JSON.stringify(cart));

  const goCart = confirm("Custom design added to cart. Go to cart?");
  if (goCart) {
    window.location.href = "customer-cart.html";
  }
}

document.getElementById("apparelType").addEventListener("change", changeApparelType);

function changeApparelType() {
  const type = document.getElementById("apparelType").value;
  const model = document.getElementById("shirtModel");

  model.className = "shirt-model";
  model.classList.add(type);
}


