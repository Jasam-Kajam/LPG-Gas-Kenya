// ============================================================
// GasHubKE Marketplace - app.js
// Production marketplace logic
// Firestore collection: listings
// ============================================================

import {
  db,
  auth,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onAuthStateChanged
} from "./firebase.js";


// ============================================================
// CONFIGURATION
// ============================================================

const LISTINGS_COLLECTION = "listings";
const CART_KEY = "gashubke_cart";
const MAX_LISTINGS = 100;


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];


// ============================================================
// SECURITY / HTML HELPERS
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}


// ============================================================
// STATE
// ============================================================

let allListings = [];
let filteredListings = [];

let currentFilters = {
  search: "",
  county: "",
  brand: "",
  size: ""
};


// ============================================================
// CART
// ============================================================

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();

  const count = cart.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  const badges = [
    "#cartCount",
    "#cartBadge",
    ".cart-count",
    "[data-cart-count]"
  ];

  badges.forEach(selector => {
    $$(selector).forEach(element => {
      element.textContent = count;
      element.style.display = count > 0 ? "" : "none";
    });
  });
}


// ============================================================
// ADD TO CART
// ============================================================

function addToCart(listing) {
  const cart = getCart();

  const existing = cart.find(
    item => item.listingId === listing.id
  );

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + 1;
  } else {
    cart.push({
      listingId: listing.id,
      title: listing.title,
      category: listing.category,
      description: listing.description,
      images: listing.images,
      location: listing.location,
      listingLocation: listing.location,
      price: Number(listing.price || 0),
      size: listing.size,
      vendorId: listing.vendorId,
      vendorName: listing.vendorName,
      quantity: 1
    });
  }

  saveCart(cart);

  showMessage(
    `${listing.title || "Product"} added to your cart.`,
    "success"
  );
}


// ============================================================
// BUY NOW
// ============================================================

function buyNow(listing) {
  const cart = getCart();

  const existing = cart.find(
    item => item.listingId === listing.id
  );

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + 1;
  } else {
    cart.push({
      listingId: listing.id,
      title: listing.title,
      category: listing.category,
      description: listing.description,
      images: listing.images,
      location: listing.location,
      listingLocation: listing.location,
      price: Number(listing.price || 0),
      size: listing.size,
      vendorId: listing.vendorId,
      vendorName: listing.vendorName,
      quantity: 1
    });
  }

  saveCart(cart);

  window.location.href = "/checkout.html";
}


// ============================================================
// NORMALIZE FIRESTORE LISTING
// ============================================================

function normalizeListing(docSnap) {
  const data = docSnap.data() || {};

  let images = [];

  if (Array.isArray(data.images)) {
    images = data.images.filter(Boolean);
  }

  // Support a possible single image field as well
  if (!images.length && data.image) {
    images = [data.image];
  }

  return {
    id: docSnap.id,

    title:
      data.title ||
      data.name ||
      "LPG Gas Product",

    category:
      data.category ||
      "LPG",

    description:
      data.description ||
      "",

    images,

    location:
      data.location ||
      data.county ||
      "Kenya",

    price:
      Number(data.price || 0),

    size:
      data.size ||
      "",

    vendorId:
      data.vendorId ||
      "",

    vendorName:
      data.vendorName ||
      data.supplierName ||
      "Verified GasHubKE Supplier",

    createdAt:
      data.createdAt || null
  };
}


// ============================================================
// LOAD LISTINGS
// ============================================================

async function loadListings() {
  const grid = getProductsGrid();

  showLoading(grid);

  try {
    const listingsRef = collection(
      db,
      LISTINGS_COLLECTION
    );

    let snapshot;

    // First try newest listings first
    try {
      const listingsQuery = query(
        listingsRef,
        orderBy("createdAt", "desc"),
        limit(MAX_LISTINGS)
      );

      snapshot = await getDocs(listingsQuery);

    } catch (orderedError) {
      console.warn(
        "Ordered listings query failed. Using fallback:",
        orderedError
      );

      const fallbackQuery = query(
        listingsRef,
        limit(MAX_LISTINGS)
      );

      snapshot = await getDocs(fallbackQuery);
    }

    allListings = snapshot.docs.map(normalizeListing);

    filteredListings = [...allListings];

    populateCountyFilter(allListings);
    populateBrandFilter(allListings);
    populateSizeFilter(allListings);

    renderListings(filteredListings);

  } catch (error) {
    console.error("Unable to load listings:", error);

    showError(
      grid,
      "Unable to load gas listings. Please refresh the page and try again."
    );
  }
}


// ============================================================
// GET PRODUCT GRID
// ============================================================

function getProductsGrid() {
  return (
    $("#productsGrid") ||
    $("#listingsGrid") ||
    $("#productGrid") ||
    $(".products-grid")
  );
}


// ============================================================
// RENDER LISTINGS
// ============================================================

function renderListings(listings) {
  const grid = getProductsGrid();

  if (!grid) {
    console.warn(
      "Products grid not found. Expected #productsGrid."
    );
    return;
  }

  if (!listings.length) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="empty-products">
          <i class="bi bi-fire"></i>
          <h4>No gas listings found</h4>
          <p>
            Try changing your search or filters.
          </p>
        </div>
      </div>
    `;

    updateResultsCount(0);
    return;
  }

  grid.innerHTML = listings
    .map(renderListingCard)
    .join("");

  updateResultsCount(listings.length);
}


// ============================================================
// PRODUCT CARD
// ============================================================

function renderListingCard(item) {
  const image =
    Array.isArray(item.images) &&
    item.images.length
      ? item.images[0]
      : "/assets/images/favicon.svg";

  const price = Number(item.price || 0)
    .toLocaleString("en-KE");

  const title = escapeHtml(
    item.title || "LPG Gas Cylinder"
  );

  const category = escapeHtml(
    item.category || "LPG"
  );

  const supplier = escapeHtml(
    item.vendorName ||
    "Verified GasHubKE Supplier"
  );

  const location = escapeHtml(
    item.location || "Kenya"
  );

  const size = escapeHtml(
    item.size || ""
  );

  return `
    <div class="col-lg-4 col-md-6 mb-4">

      <article class="gashub-product-card">

        <!-- Product image -->
        <div class="product-image-wrap">

          <span class="product-badge">
            ${category}
          </span>

          <img
            src="${escapeAttr(image)}"
            alt="${escapeAttr(title)}"
            class="product-image"
            loading="lazy"
            onerror="this.onerror=null;this.src='/assets/images/favicon.svg';"
          >

        </div>


        <!-- Product information -->
        <div class="product-card-body">

          <h3 class="product-title">
            ${title}
          </h3>


          <div class="product-supplier">
            <i class="bi bi-shop"></i>
            <span>${supplier}</span>
          </div>


          <div class="product-location">
            <i class="bi bi-geo-alt"></i>
            <span>${location}</span>
          </div>


          ${
            size
              ? `
                <div class="product-meta">
                  <i class="bi bi-box-seam"></i>
                  <span>${size}</span>
                </div>
              `
              : ""
          }


          <div class="product-bottom">

            <div class="product-price">
              <small>KES</small>
              ${price}
            </div>


            <button
              type="button"
              class="buy-now-btn"
              data-buy-now="${escapeAttr(item.id)}"
            >
              <i class="bi bi-cart3"></i>
              Buy Now
            </button>

          </div>

        </div>

      </article>

    </div>
  `;
}


// ============================================================
// FILTERING
// ============================================================

function applyFilters() {
  const search =
    currentFilters.search
      .trim()
      .toLowerCase();

  const county =
    currentFilters.county
      .trim()
      .toLowerCase();

  const brand =
    currentFilters.brand
      .trim()
      .toLowerCase();

  const size =
    currentFilters.size
      .trim()
      .toLowerCase();


  filteredListings = allListings.filter(item => {

    const searchableText = [
      item.title,
      item.category,
      item.description,
      item.location,
      item.vendorName,
      item.size
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


    const matchesSearch =
      !search ||
      searchableText.includes(search);


    const matchesCounty =
      !county ||
      String(item.location || "")
        .toLowerCase()
        .includes(county);


    const matchesBrand =
      !brand ||
      [
        item.title,
        item.category,
        item.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(brand);


    const matchesSize =
      !size ||
      String(item.size || "")
        .toLowerCase()
        .includes(size);


    return (
      matchesSearch &&
      matchesCounty &&
      matchesBrand &&
      matchesSize
    );
  });


  renderListings(filteredListings);
}


// ============================================================
// SEARCH
// ============================================================

function setupSearch() {
  const searchInput =
    $("#searchInput") ||
    $("#search") ||
    $('input[type="search"]');

  if (!searchInput) return;

  searchInput.addEventListener(
    "input",
    debounce(() => {

      currentFilters.search =
        searchInput.value;

      applyFilters();

    }, 250)
  );
}


// ============================================================
// FILTER EVENTS
// ============================================================

function setupFilters() {

  const county =
    $("#countyFilter") ||
    $("#county");

  const brand =
    $("#brandFilter") ||
    $("#brand");

  const size =
    $("#sizeFilter") ||
    $("#size");


  county?.addEventListener(
    "change",
    () => {
      currentFilters.county =
        county.value;

      applyFilters();
    }
  );


  brand?.addEventListener(
    "change",
    () => {
      currentFilters.brand =
        brand.value;

      applyFilters();
    }
  );


  size?.addEventListener(
    "change",
    () => {
      currentFilters.size =
        size.value;

      applyFilters();
    }
  );


  // Clear filters button
  const clearButton =
    $("#clearFilters") ||
    $("[data-clear-filters]");


  clearButton?.addEventListener(
    "click",
    () => {

      if (county) county.value = "";
      if (brand) brand.value = "";
      if (size) size.value = "";

      const searchInput =
        $("#searchInput") ||
        $("#search") ||
        $('input[type="search"]');

      if (searchInput) {
        searchInput.value = "";
      }

      currentFilters = {
        search: "",
        county: "",
        brand: "",
        size: ""
      };

      renderListings(allListings);
    }
  );
}


// ============================================================
// POPULATE FILTERS
// ============================================================

function populateCountyFilter(listings) {

  const select =
    $("#countyFilter") ||
    $("#county");

  if (!select) return;

  const current =
    select.value;

  const locations = [
    ...new Set(
      listings
        .map(item => item.location)
        .filter(Boolean)
    )
  ].sort();


  // Keep the existing first option
  const firstOption =
    select.querySelector("option:first-child");


  select.innerHTML = "";

  const defaultOption =
    document.createElement("option");

  defaultOption.value = "";
  defaultOption.textContent =
    firstOption?.textContent ||
    "All Locations";

  select.appendChild(defaultOption);


  locations.forEach(location => {

    const option =
      document.createElement("option");

    option.value = location;
    option.textContent = location;

    select.appendChild(option);
  });


  select.value = current;
}


function populateBrandFilter(listings) {

  const select =
    $("#brandFilter") ||
    $("#brand");

  if (!select) return;

  const current =
    select.value;


  const brands = [
    ...new Set(
      listings
        .map(item => item.category)
        .filter(Boolean)
    )
  ].sort();


  const firstOption =
    select.querySelector("option:first-child");


  select.innerHTML = "";

  const defaultOption =
    document.createElement("option");

  defaultOption.value = "";

  defaultOption.textContent =
    firstOption?.textContent ||
    "All Categories";

  select.appendChild(defaultOption);


  brands.forEach(brand => {

    const option =
      document.createElement("option");

    option.value = brand;
    option.textContent = brand;

    select.appendChild(option);
  });


  select.value = current;
}


function populateSizeFilter(listings) {

  const select =
    $("#sizeFilter") ||
    $("#size");

  if (!select) return;

  const current =
    select.value;


  const sizes = [
    ...new Set(
      listings
        .map(item => item.size)
        .filter(Boolean)
    )
  ].sort();


  const firstOption =
    select.querySelector("option:first-child");


  select.innerHTML = "";

  const defaultOption =
    document.createElement("option");

  defaultOption.value = "";

  defaultOption.textContent =
    firstOption?.textContent ||
    "All Sizes";

  select.appendChild(defaultOption);


  sizes.forEach(size => {

    const option =
      document.createElement("option");

    option.value = size;
    option.textContent = size;

    select.appendChild(option);
  });


  select.value = current;
}


// ============================================================
// BUY NOW / CART BUTTON EVENTS
// ============================================================

function setupProductActions() {

  document.addEventListener(
    "click",
    event => {

      const buyButton =
        event.target.closest(
          "[data-buy-now]"
        );

      if (!buyButton) return;


      const listingId =
        buyButton.dataset.buyNow;


      const listing =
        allListings.find(
          item => item.id === listingId
        );


      if (!listing) {
        showMessage(
          "This product is no longer available.",
          "danger"
        );

        return;
      }


      buyNow(listing);
    }
  );
}


// ============================================================
// OPTIONAL ADD-TO-CART BUTTONS
// ============================================================

function setupCartActions() {

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-add-cart]"
        );

      if (!button) return;


      const listingId =
        button.dataset.addCart;


      const listing =
        allListings.find(
          item => item.id === listingId
        );


      if (listing) {
        addToCart(listing);
      }
    }
  );
}


// ============================================================
// AUTHENTICATION UI
// ============================================================

function setupAuthUI() {

  onAuthStateChanged(
    auth,
    user => {

      const signInLinks =
        $$(
          '[data-auth="signin"], #signInLink'
        );


      const accountLinks =
        $$(
          '[data-auth="account"], #accountLink'
        );


      const supplierLinks =
        $$(
          '[data-auth="supplier"], #supplierLink'
        );


      if (user) {

        signInLinks.forEach(
          element =>
            element.style.display = "none"
        );


        accountLinks.forEach(
          element =>
            element.style.display = ""
        );


        supplierLinks.forEach(
          element =>
            element.style.display = ""
        );

      } else {

        signInLinks.forEach(
          element =>
            element.style.display = ""
        );


        accountLinks.forEach(
          element =>
            element.style.display = "none"
        );

      }
    }
  );
}


// ============================================================
// RESULTS COUNT
// ============================================================

function updateResultsCount(count) {

  const elements = $$(
    "#resultsCount, [data-results-count]"
  );


  elements.forEach(
    element => {

      element.textContent =
        `${count} ${count === 1 ? "product" : "products"}`;
    }
  );
}


// ============================================================
// LOADING STATE
// ============================================================

function showLoading(grid) {

  if (!grid) return;

  grid.innerHTML = `
    <div class="col-12">
      <div class="text-center py-5">

        <div
          class="spinner-border text-warning"
          role="status"
        >
          <span class="visually-hidden">
            Loading...
          </span>
        </div>

        <p class="text-muted mt-3 mb-0">
          Loading gas listings...
        </p>

      </div>
    </div>
  `;
}


// ============================================================
// ERROR STATE
// ============================================================

function showError(grid, message) {

  if (!grid) return;

  grid.innerHTML = `
    <div class="col-12">

      <div class="alert alert-danger text-center">

        <i class="bi bi-exclamation-triangle me-1"></i>

        ${escapeHtml(message)}

      </div>

    </div>
  `;
}


// ============================================================
// MESSAGE / TOAST
// ============================================================

function showMessage(message, type = "success") {

  let toast =
    document.querySelector(
      "#gashubToast"
    );


  if (!toast) {

    toast =
      document.createElement("div");

    toast.id =
      "gashubToast";

    toast.style.position =
      "fixed";

    toast.style.right =
      "20px";

    toast.style.bottom =
      "20px";

    toast.style.zIndex =
      "99999";

    toast.style.maxWidth =
      "360px";

    document.body.appendChild(toast);
  }


  toast.innerHTML = `
    <div class="alert alert-${escapeAttr(type)} shadow mb-0">
      ${escapeHtml(message)}
    </div>
  `;


  setTimeout(() => {

    toast.innerHTML = "";

  }, 3500);
}


// ============================================================
// DEBOUNCE
// ============================================================

function debounce(callback, delay = 250) {

  let timer;

  return (...args) => {

    clearTimeout(timer);

    timer = setTimeout(
      () => callback(...args),
      delay
    );
  };
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  // Supplier dashboard
  $$(
    '[data-link="supplier"]'
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {
        window.location.href =
          "/supplier/";
      }
    );
  });


  // Cart
  $$(
    '[data-link="cart"], #cartLink'
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {
        window.location.href =
          "/checkout.html";
      }
    );
  });


  // Settings
  $$(
    '[data-link="settings"]'
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {
        window.location.href =
          "/settings/";
      }
    );
  });
}


// ============================================================
// INITIALIZE MARKETPLACE
// ============================================================

async function initMarketplace() {

  updateCartBadge();

  setupSearch();

  setupFilters();

  setupProductActions();

  setupCartActions();

  setupAuthUI();

  setupNavigation();

  await loadListings();
}


// ============================================================
// START
// ============================================================

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initMarketplace
  );

} else {

  initMarketplace();
}