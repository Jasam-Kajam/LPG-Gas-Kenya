import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  auth,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

import { BRANDS, COUNTIES } from "./config.js";

const $ = (selector) => document.querySelector(selector);

const cart = JSON.parse(
  localStorage.getItem("gashubke_cart") || "[]"
);

/* ================================
   FILTER OPTIONS
================================ */

if ($("#county")) {
  COUNTIES.forEach((county) => {
    $("#county").insertAdjacentHTML(
      "beforeend",
      `<option value="${esc(county)}">${esc(county)}</option>`
    );
  });
}

if ($("#brand")) {
  BRANDS.forEach((brand) => {
    $("#brand").insertAdjacentHTML(
      "beforeend",
      `<option value="${esc(brand)}">${esc(brand)}</option>`
    );
  });
}

/* ================================
   HELPERS
================================ */

function money(value) {
  return new Intl.NumberFormat("en-KE").format(
    Number(value) || 0
  );
}

function saveCart() {
  localStorage.setItem(
    "gashubke_cart",
    JSON.stringify(cart)
  );

  renderCartCount();
}

function renderCartCount() {
  const countElement = $("#cartCount");

  if (!countElement) return;

  const count = cart.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  countElement.textContent = count;
}

function toast(message) {
  const toastElement = $("#toast");

  if (!toastElement) {
    alert(message);
    return;
  }

  const body = toastElement.querySelector(".toast-body");

  if (body) {
    body.textContent = message;
  }

  bootstrap.Toast
    .getOrCreateInstance(toastElement)
    .show();
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character])
  );
}

/* ================================
   LISTINGS
================================ */

let listings = [];

/*
  Convert your existing Firestore listing
  structure into a consistent frontend
  structure.
*/
function normalizeListing(doc) {
  const data = doc.data();

  return {
    id: doc.id,

    // Your Firestore fields
    title: data.title || "LPG Gas",
    category: data.category || "Cooking Gas",
    description: data.description || "",
    images: Array.isArray(data.images)
      ? data.images
      : [],

    location: data.location || "",
    price: Number(data.price) || 0,
    size: data.size || "",

    vendorId: data.vendorId || "",
    vendorName: data.vendorName || "Gas Supplier",

    createdAt: data.createdAt || null,

    // Useful aliases for the cart/frontend
    name: data.title || "LPG Gas",
    brand: data.category || "LPG",
    supplierName:
      data.vendorName || "Gas Supplier",
    county: data.location || ""
  };
}

/* ================================
   LOAD LISTINGS FROM FIRESTORE
================================ */

async function loadListings() {
  try {
    /*
      IMPORTANT:
      Your marketplace collection is
      "listings", NOT "products".
    */

    let snapshot;

    try {
      const listingsQuery = query(
        collection(db, "listings"),
        orderBy("createdAt", "desc"),
        limit(100)
      );

      snapshot = await getDocs(listingsQuery);

    } catch (queryError) {

      /*
        Fallback in case createdAt contains
        mixed data types or the required
        Firestore index is not available.
      */

      console.warn(
        "Ordered listings query failed. Loading listings without ordering.",
        queryError
      );

      const fallbackQuery = query(
        collection(db, "listings"),
        limit(100)
      );

      snapshot = await getDocs(fallbackQuery);
    }

    listings = snapshot.docs.map(normalizeListing);

    renderListings();

  } catch (error) {

    console.error(
      "Unable to load marketplace listings:",
      error
    );

    listings = [];

    renderListings();

    toast(
      "Unable to load listings. Please check your Firebase connection."
    );

  } finally {

    const loader = $("#app-loader");

    if (loader) {
      loader.remove();
    }
  }
}

/* ================================
   RENDER LISTINGS
================================ */

function renderListings() {

  const container = $("#products");

  if (!container) return;

  const searchTerm =
    ($("#search")?.value || "")
      .toLowerCase()
      .trim();

  const selectedCounty =
    $("#county")?.value || "";

  const selectedBrand =
    $("#brand")?.value || "";

  const selectedSize =
    $("#size")?.value || "";

  const sort =
    $("#sort")?.value || "recent";

  let filtered = listings.filter((listing) => {

    const searchableText = [
      listing.title,
      listing.category,
      listing.description,
      listing.location,
      listing.vendorName,
      listing.size
    ]
      .join(" ")
      .toLowerCase();

    const locationText =
      String(listing.location || "")
        .toLowerCase();

    const brandText = [
      listing.title,
      listing.category,
      listing.description
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !searchTerm ||
      searchableText.includes(searchTerm);

    /*
      Your database has "location", not
      a separate "county" field.
      Therefore county filtering checks
      the location text.
    */
    const matchesCounty =
      !selectedCounty ||
      locationText.includes(
        selectedCounty.toLowerCase()
      );

    /*
      Your database does not have a separate
      "brand" field.

      We therefore search the title,
      category and description for the
      selected brand.
    */
    const matchesBrand =
      !selectedBrand ||
      brandText.includes(
        selectedBrand.toLowerCase()
      );

    const matchesSize =
      !selectedSize ||
      String(listing.size)
        .toLowerCase()
        .includes(
          selectedSize.toLowerCase()
        );

    return (
      matchesSearch &&
      matchesCounty &&
      matchesBrand &&
      matchesSize
    );
  });

  /* ================================
     SORTING
  ================================ */

  if (sort === "priceAsc") {

    filtered.sort(
      (a, b) =>
        Number(a.price || 0) -
        Number(b.price || 0)
    );

  } else if (sort === "priceDesc") {

    filtered.sort(
      (a, b) =>
        Number(b.price || 0) -
        Number(a.price || 0)
    );
  }

  /* ================================
     RESULT COUNT
  ================================ */

  const resultCount = $("#resultCount");

  if (resultCount) {
    resultCount.textContent =
      `${filtered.length} listing${
        filtered.length === 1 ? "" : "s"
      }`;
  }

  /* ================================
     NO RESULTS
  ================================ */

  const empty = $("#empty");

  if (empty) {
    empty.classList.toggle(
      "d-none",
      filtered.length > 0
    );
  }

  /* ================================
     DISPLAY LISTINGS
  ================================ */

  container.innerHTML = filtered
    .map((listing) => {

      const image =
        listing.images?.length
          ? listing.images[0]
          : null;

      const imageHTML = image
        ? `
          <img
            src="${esc(image)}"
            alt="${esc(listing.title)}"
            loading="lazy"
            style="
              width:100%;
              height:100%;
              object-fit:cover;
            "
            onerror="this.style.display='none'"
          >
        `
        : `
          <i class="bi bi-fire"></i>
        `;

      return `
        <div class="col-sm-6 col-lg-4 col-xl-3">

          <article class="product-card">

            <div class="product-img">
              ${imageHTML}
            </div>

            <div class="product-body">

              <div
                class="d-flex justify-content-between gap-2"
              >

                <h5 class="mb-1">
                  ${esc(listing.title)}
                </h5>

                <span
                  class="badge badge-verified"
                >
                  Verified
                </span>

              </div>

              <div class="supplier">

                ${esc(listing.category)}

                ${listing.size
                  ? ` · ${esc(listing.size)}`
                  : ""
                }

                ${listing.location
                  ? ` · ${esc(listing.location)}`
                  : ""
                }

              </div>

              <div class="small text-muted mt-2">

                <i class="bi bi-shop"></i>

                ${esc(listing.vendorName)}

              </div>

              <div class="price mt-3">

                KES ${money(listing.price)}

              </div>

              <button
                class="btn btn-orange w-100 mt-3 add-cart"
                data-id="${esc(listing.id)}"
              >

                <i class="bi bi-cart-plus"></i>

                Add to cart

              </button>

            </div>

          </article>

        </div>
      `;
    })
    .join("");

  /* ================================
     ADD TO CART EVENTS
  ================================ */

  document
    .querySelectorAll(".add-cart")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {
          addToCart(button.dataset.id);
        }
      );

    });
}

/* ================================
   CART
================================ */

function addToCart(id) {

  const listing =
    listings.find(
      (item) => item.id === id
    );

  if (!listing) {
    toast("Listing not found.");
    return;
  }

  const existing =
    cart.find(
      (item) => item.id === id
    );

  if (existing) {

    existing.quantity += 1;

  } else {

    cart.push({
      id: listing.id,
      quantity: 1,

      /*
        Keep the complete listing so
        checkout has access to vendorId,
        vendorName, price, etc.
      */
      product: listing
    });

  }

  saveCart();

  toast(
    `${listing.title} added to cart.`
  );
}

/* ================================
   RENDER CART
================================ */

function renderCart() {

  const cartItems = $("#cartItems");

  if (!cartItems) return;

  if (!cart.length) {

    cartItems.innerHTML = `
      <div class="text-center text-muted py-5">

        <i
          class="bi bi-cart-x"
          style="font-size:3rem"
        ></i>

        <p class="mt-3">
          Your cart is empty.
        </p>

      </div>
    `;

  } else {

    cartItems.innerHTML = cart
      .map((item, index) => {

        const product =
          item.product || {};

        return `
          <div
            class="d-flex justify-content-between
                   border-bottom py-3 gap-3"
          >

            <div>

              <strong>
                ${esc(
                  product.title ||
                  product.name ||
                  "LPG Gas"
                )}
              </strong>

              <div class="small text-muted">

                ${esc(
                  product.category ||
                  product.brand ||
                  "LPG"
                )}

                ${
                  product.size
                    ? ` · ${esc(product.size)}`
                    : ""
                }

              </div>

              <div class="small text-muted">

                ${esc(
                  product.vendorName ||
                  product.supplierName ||
                  "Gas Supplier"
                )}

              </div>

              <div class="mt-1">

                KES ${money(product.price)}

                × ${item.quantity}

              </div>

            </div>

            <button
              class="btn btn-sm btn-outline-danger
                     remove-cart"
              data-index="${index}"
            >
              Remove
            </button>

          </div>
        `;
      })
      .join("");
  }

  const total = cart.reduce(
    (total, item) => {

      const price =
        Number(
          item.product?.price || 0
        );

      return total +
        price * Number(item.quantity || 0);

    },
    0
  );

  if ($("#cartTotal")) {
    $("#cartTotal").textContent =
      money(total);
  }

  document
    .querySelectorAll(".remove-cart")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.index
            );

          cart.splice(index, 1);

          saveCart();

          renderCart();
        }
      );

    });
}

/* ================================
   CART BUTTON
================================ */

const cartButton = $("#cartBtn");

if (cartButton) {

  cartButton.addEventListener(
    "click",
    () => {

      renderCart();

      const modal =
        $("#cartModal");

      if (modal) {

        bootstrap.Modal
          .getOrCreateInstance(modal)
          .show();

      }

    }
  );
}

/* ================================
   CHECKOUT
================================ */

const checkoutButton =
  $("#checkoutBtn");

if (checkoutButton) {

  checkoutButton.addEventListener(
    "click",
    () => {

      if (!cart.length) {

        toast(
          "Your cart is empty."
        );

        return;
      }

      if (!auth.currentUser) {

        location.href =
          "/auth/login.html?next=/checkout.html";

        return;
      }

      location.href =
        "/checkout.html";
    }
  );
}

/* ================================
   FILTER EVENTS
================================ */

[
  "search",
  "county",
  "brand",
  "size",
  "sort"
].forEach((id) => {

  const element = $(`#${id}`);

  if (!element) return;

  element.addEventListener(
    "input",
    renderListings
  );

  element.addEventListener(
    "change",
    renderListings
  );
});

/* ================================
   AUTH STATE
================================ */

onAuthStateChanged(
  auth,
  (user) => {

    const authButton =
      $("#authBtn");

    if (!authButton) return;

    if (user) {

      authButton.textContent =
        "Account";

      authButton.onclick =
        () => {
          location.href =
            "/settings/";
        };

    } else {

      authButton.textContent =
        "Sign in";

      authButton.onclick =
        () => {
          location.href =
            "/auth/login.html";
        };

    }
  }
);

/* ================================
   START APPLICATION
================================ */

renderCartCount();

loadListings();