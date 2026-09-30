import { db, collection, getDocs, query, where, orderBy, limit, auth, onAuthStateChanged, signOut } from "./firebase.js";
import { BRANDS, COUNTIES, APP_CONFIG } from "./config.js";

const $ = s => document.querySelector(s);
const cart = JSON.parse(localStorage.getItem("gashubke_cart") || "[]");

COUNTIES.forEach(c => $("#county").insertAdjacentHTML("beforeend", `<option>${c}</option>`));
BRANDS.forEach(b => $("#brand").insertAdjacentHTML("beforeend", `<option>${b}</option>`));

function money(n){return new Intl.NumberFormat("en-KE").format(Number(n)||0)}
function saveCart(){localStorage.setItem("gashubke_cart",JSON.stringify(cart));renderCartCount()}
function renderCartCount(){$("#cartCount").textContent=cart.reduce((a,x)=>a+x.quantity,0)}
function toast(message){$("#toast .toast-body").textContent=message;bootstrap.Toast.getOrCreateInstance($("#toast")).show()}

let products=[];
async function loadProducts(){
  try{
    const q=query(collection(db,"products"),where("status","==","active"),orderBy("createdAt","desc"),limit(100));
    const snap=await getDocs(q);
    products=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){
    console.warn(e);
    products=[];
  }
  renderProducts();
  $("#app-loader").remove();
}
function renderProducts(){
  const term=$("#search").value.toLowerCase().trim(), county=$("#county").value, brand=$("#brand").value, size=$("#size").value, sort=$("#sort").value;
  let list=products.filter(p=>(!term || `${p.name} ${p.brand} ${p.supplierName}`.toLowerCase().includes(term))&&(!county||p.county===county)&&(!brand||p.brand===brand)&&(!size||p.size===size));
  if(sort==="priceAsc")list.sort((a,b)=>(a.price||0)-(b.price||0));
  if(sort==="priceDesc")list.sort((a,b)=>(b.price||0)-(a.price||0));
  $("#resultCount").textContent=`${list.length} listing${list.length===1?"":"s"}`;
  $("#products").innerHTML=list.map(p=>`
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <article class="product-card">
        <div class="product-img"><i class="bi bi-fire"></i></div>
        <div class="product-body">
          <div class="d-flex justify-content-between gap-2"><h5 class="mb-1">${esc(p.name||"LPG Cylinder")}</h5><span class="badge badge-verified">Verified</span></div>
          <div class="supplier">${esc(p.brand||"LPG")} · ${esc(p.size||"")} · ${esc(p.county||"Kenya")}</div>
          <div class="price mt-3">KES ${money(p.price)}</div>
          <button class="btn btn-orange w-100 mt-3 add-cart" data-id="${p.id}"><i class="bi bi-cart-plus"></i> Add to cart</button>
        </div>
      </article>
    </div>`).join("");
  $("#empty").classList.toggle("d-none",list.length>0);
  document.querySelectorAll(".add-cart").forEach(b=>b.onclick=()=>addToCart(b.dataset.id));
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function addToCart(id){const p=products.find(x=>x.id===id);if(!p)return;const x=cart.find(x=>x.id===id);if(x)x.quantity++;else cart.push({id,quantity:1,product:p});saveCart();toast("Added to cart.");}
function renderCart(){
  $("#cartItems").innerHTML=cart.length?cart.map((x,i)=>`<div class="d-flex justify-content-between border-bottom py-3"><div><strong>${esc(x.product.name)}</strong><div class="small text-muted">${x.product.size} · ${x.product.brand}</div><div>KES ${money(x.product.price)} × ${x.quantity}</div></div><button class="btn btn-sm btn-outline-danger remove-cart" data-i="${i}">Remove</button></div>`).join(""):`<div class="text-center text-muted py-5">Your cart is empty.</div>`;
  $("#cartTotal").textContent=money(cart.reduce((a,x)=>a+(Number(x.product.price)||0)*x.quantity,0));
  document.querySelectorAll(".remove-cart").forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.i),1);saveCart();renderCart()});
}
$("#cartBtn").onclick=()=>{renderCart();bootstrap.Modal.getOrCreateInstance($("#cartModal")).show()};
$("#checkoutBtn").onclick=async()=>{if(!cart.length)return toast("Your cart is empty.");if(!auth.currentUser)return location.href="/auth/login.html?next=/";location.href="/checkout.html"};
["search","county","brand","size","sort"].forEach(id=>$("#"+id).addEventListener("input",renderProducts));
onAuthStateChanged(auth,u=>{$("#authBtn").textContent=u?"Account":"Sign in";$("#authBtn").onclick=()=>u?signOut(auth):location.href="/auth/login.html"});
renderCartCount();loadProducts();
