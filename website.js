window.__ccWebsiteLoggerActive=true;
const SUPABASE_URL="https://rwfamxkfqslorxcryjrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_tzfe2xVn6OAwF-Mh5_u_zQ_a_bAW7tO";
const siteDb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:"cleancore-customer-auth",storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const escSite=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const waPhone="919182725773";
const phoneRE=/^[6-9]\d{9}$/;
const SITE_VERSION="3.97.0";
let siteErrorBusy=false;
// Report every client-side website failure to CleanCore Manager's Error Finder.
// This includes broken images, script failures, unhandled promise rejections,
// auth/order/enquiry errors, and runtime exceptions.
function reportWebsiteClientError(err,meta={}){
 const e=err instanceof Error?err:new Error(String(err||"Unknown error"));
 if(typeof reportSiteError==="function"){
   reportSiteError(e,{app_name:"CleanCore Website",action:meta.action||"website_error",context:{...meta.context,source:"customer_website"}});
 }
}

function setCleanCoreActiveNav(){if(!document.getElementById("cc-nav-active-runtime")){const s=document.createElement("style");s.id="cc-nav-active-runtime";s.textContent="@media (min-width:801px){header nav .navlinks a:first-child{color:#566675!important;background:transparent!important;box-shadow:none!important}header nav .navlinks a.cc-nav-current{color:#0b1f33!important;background:#fff!important;box-shadow:0 3px 9px rgba(11,31,51,.08)!important}}";document.head.appendChild(s);}const links=document.querySelectorAll("header nav .navlinks a[href]");if(!links.length)return;const current=(location.pathname.split("/").pop()||"index.html").split("?")[0].split("#")[0]||"index.html";links.forEach(a=>{const href=(a.getAttribute("href")||"").split("/").pop().split("?")[0].split("#")[0]||"index.html";a.classList.toggle("cc-nav-current",href===current);});}
function siteErrorQueueRead(){try{const q=JSON.parse(localStorage.getItem("cleancore_site_error_queue")||"[]");return Array.isArray(q)?q:[];}catch{return [];}}
function siteErrorQueueWrite(q){try{localStorage.setItem("cleancore_site_error_queue",JSON.stringify(q.slice(-30)));}catch{}}
async function sendSiteErrorPayload(payload,queueOnFail=true){
 if(!siteDb)return false;
 try{const {error}=await siteDb.rpc("log_client_error",payload);if(error)throw error;return true;}
 catch(err){
   if(queueOnFail){const q=siteErrorQueueRead();q.push({...payload,queued_at:new Date().toISOString(),logger_error:String(err?.message||err)});siteErrorQueueWrite(q);}
   return false;
 }
}
async function flushSiteErrorQueue(){
 const q=siteErrorQueueRead();if(!q.length)return;
 const remaining=[];
 for(const payload of q){if(!(await sendSiteErrorPayload(payload,false)))remaining.push(payload);}
 siteErrorQueueWrite(remaining);
}
function reportSiteError(err,meta={}){
 const e=err instanceof Error?err:new Error(String(err||"Unknown error"));
 const payload={p_app_name:meta.app_name||"CleanCore Website",p_app_version:SITE_VERSION,p_page:location.pathname.split("/").pop()||"index.html",p_url:location.href,p_action:meta.action||"website_error",p_error_name:e.name||"Error",p_message:String(e.message||e).slice(0,4000),p_stack:String(e.stack||"").slice(0,12000),p_context:{...(meta.context||{}),source:"customer_website"},p_user_agent:navigator.userAgent};
 void sendSiteErrorPayload(payload);
}
if(!window.__ccErrorMonitorInstalled){window.addEventListener("error",e=>reportSiteError(e.error||new Error(e.message||"Unhandled browser error"),{action:"window_error",context:{source:e.filename||"",line:e.lineno||0,column:e.colno||0}}));window.addEventListener("unhandledrejection",e=>reportSiteError(e.reason||new Error("Unhandled promise rejection"),{action:"unhandled_rejection"}));window.addEventListener("online",()=>void flushSiteErrorQueue());document.addEventListener("error",e=>{const t=e.target;if(t&&(t.tagName==="IMG"||t.tagName==="SCRIPT"||t.tagName==="LINK"))reportSiteError(new Error("Failed to load "+t.tagName.toLowerCase()+": "+(t.src||t.href||"")),{action:"resource_load_error",context:{resource:t.src||t.href||"",tag:t.tagName}})},true);}

let publicProducts=[];
let customerUser=null;
let customerProfile=null;
let pendingOrderProduct=null;
let customerCart=loadCustomerCart();

function loadCustomerCart(){
  try{
    const raw=localStorage.getItem("cleancore_cart");
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed.filter(x=>x&&x.product_id&&Number(x.quantity)>0):[];
  }catch(_){return [];}
}
function saveCustomerCart(){
  try{localStorage.setItem("cleancore_cart",JSON.stringify(customerCart));}catch(_){}
  renderCartCount();
}
function cartCount(){return customerCart.reduce((n,x)=>n+Number(x.quantity||0),0);}
function cartSubtotal(){
  return customerCart.reduce((n,x)=>n+Number(x.price||0)*Number(x.quantity||0),0);
}
function addToCart(product,quantity=1){
  if(!product)return;
  const q=Math.max(1,Math.floor(Number(quantity)||1));
  const existing=customerCart.find(x=>x.product_id===product.id);
  if(existing)existing.quantity+=q;
  else customerCart.push({product_id:product.id,name:product.name,unit:product.unit,price:Number(product.selling_price||0),quantity:q});
  saveCustomerCart();
}
function updateCartQuantity(productId,delta){
  const item=customerCart.find(x=>x.product_id===productId);
  if(!item)return;
  item.quantity=Math.max(0,Number(item.quantity||0)+delta);
  customerCart=customerCart.filter(x=>x.quantity>0);
  saveCustomerCart();
  renderCart();
  renderCheckoutItems();
}
function removeCartItem(productId){
  customerCart=customerCart.filter(x=>x.product_id!==productId);
  saveCustomerCart();
  renderCart();
}
function renderCartCount(){
  const count=cartCount();
  const a=document.getElementById("ccCartLink");
  if(a){
    a.setAttribute("aria-label",count>0?"Cart ("+count+")":"Cart");
    const label=a.querySelector(".customer-action-label");
    if(label)label.textContent=count>0?"Cart ("+count+")":"Cart";
  }
  const ml=document.getElementById("ccMobileCartLabel");
  if(ml)ml.textContent=count>0?"Cart ("+count+")":"Cart";
}
function renderCart(){
  const panel=document.getElementById("ccCartItems");
  const total=document.getElementById("ccCartTotal");
  const checkout=document.getElementById("ccCartCheckout");
  if(!panel)return;
  if(!customerCart.length){
    panel.innerHTML='<div class="cc-cart-empty"><div class="cc-cart-empty-icon">🛒</div><h3>Your cart is empty</h3><p>Browse products and add items to your cart.</p><button type="button" class="btn btn-primary" id="ccContinueShopping">Continue shopping</button></div>';
    if(total)total.textContent=siteMoney(0);
    if(checkout)checkout.disabled=true;
    document.getElementById("ccContinueShopping")?.addEventListener("click",closeCustomerPanel);
    return;
  }
  panel.innerHTML=customerCart.map(item=>'<div class="cc-cart-item"><div class="cc-cart-item-main"><strong>'+escSite(item.name)+'</strong><span>'+escSite(item.unit)+' · '+siteMoney(item.price)+'</span></div><div class="cc-cart-item-actions"><button type="button" data-cart-dec="'+escSite(item.product_id)+'" aria-label="Decrease quantity">−</button><b>'+item.quantity+'</b><button type="button" data-cart-inc="'+escSite(item.product_id)+'" aria-label="Increase quantity">+</button><button type="button" class="cc-cart-remove" data-cart-remove="'+escSite(item.product_id)+'">Remove</button></div></div>').join("");
  if(total)total.textContent=siteMoney(cartSubtotal());
  if(checkout)checkout.disabled=false;
}
function openCart(){ window.location.href="checkout.html"; }
function closeCart(){}
function showCheckout(){ window.location.href="checkout.html"; }

function fillCheckoutCustomer(){
  document.getElementById("ccCustomerName").value=customerProfile?.name==="Customer"?"":(customerProfile?.name||"");
  document.getElementById("ccCustomerEmail").value=customerProfile?.email||"";
  document.getElementById("ccAlternatePhone").value=customerProfile?.alternate_phone||"";
  document.getElementById("ccOrderNotes").value=customerProfile?.delivery_address||"";
}
function customerSourceFromLocation(){
 const src=new URLSearchParams(location.search).get("source");
 return src==="whatsapp"?"WhatsApp":src==="landing"?"Landing Page":src==="website"?"Website":"Landing Page";
}
function getSafeNext(){
  const next=new URLSearchParams(location.search).get("next")||"index.html";
  return next==="checkout.html"||next==="account.html"||next==="index.html"?"./"+next:"./index.html";
}
async function refreshCheckoutCartPrices(){
  const ids=[...new Set(customerCart.map(x=>x.product_id))];
  if(!ids.length)return {removed:0};
  const {data,error}=await siteDb.from("website_products").select("id,name,unit,selling_price,active,stock").in("id",ids).eq("active",true);
  if(error||!Array.isArray(data))return {removed:0};
  const available=data.filter(p=>Number(p.stock||0)>0);
  const products=new Map(available.map(p=>[p.id,p]));
  const before=customerCart.length;
  customerCart=customerCart.map(x=>{
    const p=products.get(x.product_id);
    if(!p)return null;
    return {...x,name:p.name,unit:p.unit,price:Number(p.selling_price||0)};
  }).filter(Boolean);
  saveCustomerCart();
  return {removed:before-customerCart.length};
}
function renderCheckoutItems(){
  const box=document.getElementById("checkoutItems")||document.getElementById("ccCheckoutItems");
  if(!box)return;
  if(!customerCart.length){
    box.innerHTML='<div class="checkout-empty-inline"><p>Your cart is empty.</p><a class="btn btn-secondary" href="products.html">Continue shopping</a></div>';
    const t=document.getElementById("checkoutTotal")||document.getElementById("ccOrderTotal");
    if(t)t.textContent=siteMoney(0);
    return;
  }
  box.innerHTML=customerCart.map(item=>'<div class="checkout-item" data-checkout-item="'+escSite(item.product_id)+'"><div><strong>'+escSite(item.name)+'</strong><span>'+escSite(item.unit)+' · '+siteMoney(item.price)+' each</span></div><div class="checkout-item-controls"><div class="qty-control"><button type="button" data-checkout-dec="'+escSite(item.product_id)+'" aria-label="Decrease quantity">−</button><b>'+item.quantity+'</b><button type="button" data-checkout-inc="'+escSite(item.product_id)+'" aria-label="Increase quantity">+</button></div><strong>'+siteMoney(Number(item.price)*Number(item.quantity))+'</strong><button type="button" class="checkout-remove" data-checkout-remove="'+escSite(item.product_id)+'">Remove</button></div></div>').join("");
  const total=siteMoney(cartSubtotal());
  const t=document.getElementById("checkoutTotal")||document.getElementById("ccOrderTotal");
  if(t)t.textContent=total;
}
function renderCheckoutSummary(){
  renderCheckoutItems();
  const status=document.getElementById("ccOrderStatus");
  if(status)status.textContent="";
}


function siteMoney(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));}

async function invokeCustomerAuth(body){
  try{
    const response=await fetch(SUPABASE_URL+"/functions/v1/customer-auth",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_PUBLISHABLE_KEY,
        "Authorization":"Bearer "+SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify(body)
    });
    const raw=await response.text();
    let payload=null;
    try{payload=raw?JSON.parse(raw):null}catch(_){}
    if(!response.ok){
      return {data:null,error:{message:payload?.error||payload?.message||("Customer auth failed ("+response.status+").")}};
    }
    return {data:payload,error:null};
  }catch(e){
    return {data:null,error:{message:e?.message||"Unable to reach customer authentication service."}};
  }
}
function normalizeSitePhone(v){const digits=String(v||"").replace(/\D/g,"");return digits.length===12&&digits.startsWith("91")?digits.slice(2):digits;}
function validSiteEmail(v){const email=String(v||"").trim();return !email||/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);}
async function loadPublicProducts(){
  if(!siteDb)return;
  const {data,error}=await siteDb.from("website_products")
    .select("id,name,unit,mrp,selling_price,description,additional_details,image_urls,video_urls,active,stock,seo_title,seo_description,seo_keywords,seo_slug")
    .eq("active",true).order("name");
  if(error||!Array.isArray(data)||!data.length)return;
  publicProducts=data;
  document.querySelectorAll(".product-grid").forEach((grid,index)=>{
    const list=(location.pathname.toLowerCase().includes("products.html")||index>0)?data:data.slice(0,4);
    grid.innerHTML=list.map(p=>{
      const img=Array.isArray(p.image_urls)?p.image_urls[0]:"";
      const art=img
        ? '<div class="imgbox"><img class="prod-img" src="'+escSite(img)+'" alt="'+escSite(p.name)+'"></div>'
        : '<div class="imgbox product-placeholder"><div>'+escSite(String(p.name||"").trim().charAt(0).toUpperCase())+'</div></div>';
      const priceMarkup=location.pathname.toLowerCase().includes("products.html")?'<div class="price"><span class="cc-mrp">MRP '+siteMoney(p.mrp)+'</span><strong>'+siteMoney(p.selling_price)+'</strong> <small>/ '+escSite(p.unit)+'</small></div>':"";
      const inStock=Number(p.stock||0)>0; const stockMarkup=inStock?'':'<div class="stock-out">Out of stock</div>'; const buttonMarkup=inStock?'<button type="button" class="btn btn-primary order-now" data-product-id="'+escSite(p.id)+'">Add to Cart</button>':'<button type="button" class="btn btn-secondary order-now" data-product-id="'+escSite(p.id)+'" disabled>Out of stock</button>'; const slug=p.seo_slug||String(p.name||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); const detailUrl="product.html?slug="+encodeURIComponent(slug); return '<article class="product product-link cc-reference-card" data-product-url="'+escSite(detailUrl)+'" tabindex="0" role="link">'+art+'<div class="product-body"><span class="tag">'+escSite(p.unit||"5 Litre Can")+'</span><h3><a class="product-title-link" href="'+detailUrl+'">'+escSite(p.name)+'</a></h3>'+(inStock?'':'<div class="cc-reference-stock">OUT OF STOCK</div>')+(priceMarkup)+(inStock?'<button type="button" class="btn btn-primary order-now" data-product-id="'+escSite(p.id)+'">Add to Cart</button>':'<button type="button" class="btn btn-secondary order-now cc-reference-disabled" data-product-id="'+escSite(p.id)+'" disabled>Out of stock</button>')+'</div></article>';
    }).join("");
  });
}

function populateEnquiryProducts(){
  const select=document.getElementById("websiteProduct");
  if(!select||!siteDb)return;
  siteDb.from("website_products").select("id,name,unit,selling_price,active").eq("active",true).order("name").then(({data})=>{
    if(!Array.isArray(data))return;
    select.innerHTML='<option value="">Select product</option>'+data.map(p=>'<option value="'+escSite(p.name)+'">'+escSite(p.name)+' — '+siteMoney(p.selling_price)+' / '+escSite(p.unit)+'</option>').join("");
  });
}

function bindWebsiteEnquiry(){
  const form=document.getElementById("websiteEnquiryForm");
  if(!form||!siteDb)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const msg=document.getElementById("websiteEnquiryStatus");
    const phone=normalizeSitePhone(document.getElementById("websitePhone").value).slice(0,10);
    if(!phoneRE.test(phone)){msg.textContent="Enter a valid 10-digit mobile number.";return;}
    const quantity=Number(document.getElementById("websiteQuantity").value||0);
    const payload={
      name:document.getElementById("websiteName").value.trim(),
      phone,
      business:document.getElementById("websiteBusiness").value.trim(),
      email:document.getElementById("websiteEmail").value.trim(),
      product_name:document.getElementById("websiteProduct").value||null,
      quantity:quantity>0?quantity:null,
      message:document.getElementById("websiteMessage").value.trim(),
      source:"website",
      status:"New"
    };
    if(!payload.name){msg.textContent="Enter your name.";return;}
    if(!validSiteEmail(payload.email)){msg.textContent="Enter a valid email address.";return;}
    // Always record the enquiry. Existing customers/leads may submit again; enquiries are not de-duplicated.
    const {error}=await siteDb.from("enquiries").insert(payload);
    if(error){reportSiteError(error,{action:"website_enquiry_insert"});msg.textContent="Unable to send right now. Please use the order form or contact CleanCore.";return;}
    form.reset();
    msg.textContent="Request sent. CleanCore will contact you.";
  });
}

function injectEnquiryWidget(){
  if(document.getElementById("ccEnquiryWidget"))return;
  const root=document.createElement("div");
  root.id="ccEnquiryWidget";
  root.innerHTML=`
    <button type="button" class="cc-enquiry-tab ccx-tab" id="ccEnquiryOpen" aria-label="Open enquiry form">
      <span class="ccx-tab-icon" aria-hidden="true">?</span><span>Enquire</span>
    </button>
    <div class="ccx-overlay hidden" id="ccEnquiryOverlay" aria-hidden="true">
      <section class="ccx-dialog" role="dialog" aria-modal="true" aria-labelledby="ccEnquiryTitle">
        <button type="button" class="ccx-close" id="ccEnquiryClose" aria-label="Close enquiry">×</button>
        <div class="ccx-head">
          <span class="ccx-kicker">CLEANCORE CONTACT</span>
          <h2 id="ccEnquiryTitle">Request a quote</h2>
          <p>Send a few details. Our CleanCore team will contact you.</p>
        </div>
        <div class="ccx-contact-strip">
          <a href="tel:+919182725773"><span>☎</span><b>Call</b></a>
          <a href="https://wa.me/919182725773?text=Hello%20CleanCore%2C%20I%20have%20an%20enquiry." target="_blank" rel="noopener"><span>◉</span><b>WhatsApp</b></a>
          <a href="mailto:cleancorehyd@gmail.com"><span>✉</span><b>Email</b></a>
        </div>
        <form id="ccQuickEnquiryForm" class="ccx-form" novalidate>
          <div class="ccx-row ccx-row-2">
            <label><span>Your name</span><input id="ccEnquiryName" type="text" autocomplete="name" placeholder="Enter your name" required></label>
            <label><span>Mobile number</span><input id="ccEnquiryPhone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="10-digit number" required></label>
          </div>
          <label><span>Email address</span><input id="ccEnquiryEmail" type="email" autocomplete="email" placeholder="name@company.com"></label>
          <label><span>Message</span><textarea id="ccEnquiryMessage" rows="4" placeholder="Product, quantity, delivery area, or anything else..."></textarea></label>
          <div class="ccx-submit-row">
            <p id="ccQuickEnquiryStatus" class="cc-enquiry-status" aria-live="polite"></p>
            <button class="ccx-submit" type="submit"><span>Send enquiry</span><strong>→</strong></button>
          </div>
        </form>
      </section>
    </div>`;
  document.body.appendChild(root);
  const overlay=document.getElementById("ccEnquiryOverlay");
  const open=()=>{overlay.classList.remove("hidden");overlay.setAttribute("aria-hidden","false");document.body.classList.add("cc-modal-open");setTimeout(()=>document.getElementById("ccEnquiryName")?.focus(),60)};
  const close=()=>{overlay.classList.add("hidden");overlay.setAttribute("aria-hidden","true");document.body.classList.remove("cc-modal-open")};
  document.getElementById("ccEnquiryOpen").addEventListener("click",open);
  document.getElementById("ccEnquiryClose").addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.classList.contains("hidden"))close()});
  document.getElementById("ccQuickEnquiryForm").addEventListener("submit",e=>{
    e.preventDefault();
    const status=document.getElementById("ccQuickEnquiryStatus");
    const name=document.getElementById("ccEnquiryName").value.trim();
    const phone=normalizeSitePhone(document.getElementById("ccEnquiryPhone").value).slice(0,10);
    const email=document.getElementById("ccEnquiryEmail").value.trim();
    const message=document.getElementById("ccEnquiryMessage").value.trim();
    if(!name){status.textContent="Enter your name.";return}
    if(!phoneRE.test(phone)){status.textContent="Enter a valid 10-digit mobile number.";return}
    if(email && !validSiteEmail(email)){status.textContent="Enter a valid email address.";return}
    const payload={name,phone,email:email||null,message:message||null,source:"website",status:"New"};
    const request=fetch(SUPABASE_URL+"/rest/v1/enquiries",{
      method:"POST",
      headers:{"apikey":SUPABASE_PUBLISHABLE_KEY,"Authorization":"Bearer "+SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify(payload),keepalive:true
    }).catch(()=>{});
    status.textContent="Enquiry sent. We will contact you shortly.";
    e.currentTarget.reset();
    close();
    void request;
  });
}

function bindSharedMenu(){
  const b=document.getElementById("menuToggle"),m=document.getElementById("navMenu");
  if(!b||!m||b.dataset.ccMenuBound==="1")return;
  b.dataset.ccMenuBound="1";
  // Capture first so legacy page handlers cannot toggle the menu twice.
  b.addEventListener("click",function(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const open=!m.classList.contains("open");
    m.classList.toggle("open",open);
    b.classList.toggle("open",open);
    b.setAttribute("aria-expanded",open?"true":"false");
    b.setAttribute("aria-label",open?"Close navigation":"Open navigation");
  },true);
  m.querySelectorAll("a").forEach(a=>a.addEventListener("click",function(){
    m.classList.remove("open");b.classList.remove("open");
    b.setAttribute("aria-expanded","false");
    b.setAttribute("aria-label","Open navigation");
  }));
  window.addEventListener("resize",function(){
    if(window.innerWidth>800){
      m.classList.remove("open");b.classList.remove("open");
      b.setAttribute("aria-expanded","false");
      b.setAttribute("aria-label","Open navigation");
    }
  });
}

function ensureSharedNav(){
  const nav=document.getElementById("navMenu");
  if(!nav)return null;
  let actions=document.getElementById("navUserActions");
  if(!actions){actions=document.createElement("div");actions.id="navUserActions";actions.className="nav-user-actions";nav.parentNode.insertBefore(actions,nav);}
  return {nav,actions};
}
function injectCustomerUI(){
  const shared=ensureSharedNav();
  if(!shared)return;
  const {actions}=shared;
  actions.classList.add("cc-nav-actions-ready");
  if(!document.getElementById("ccCustomerLink")){
    const a=document.createElement("a");
    a.id="ccCustomerLink";
    a.href=customerUser&&customerProfile?"account.html?v=3.80":"customer-login.html";
    a.className="customer-nav-action account-nav-action";
    a.setAttribute("aria-label",customerUser&&customerProfile?"My Account":"Login");
    a.innerHTML='<span class="customer-face" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"></circle><path d="M5.5 19c.7-3.2 2.8-5 6.5-5s5.8 1.8 6.5 5"></path></svg></span><span class="customer-action-label">'+(customerUser&&customerProfile?"My Account":"Login")+'</span>';
    actions.appendChild(a);
  }
  if(!document.getElementById("ccCartLink")){
    const cart=document.createElement("a");
    cart.id="ccCartLink";cart.href="checkout.html";cart.className="customer-nav-action cart-nav-action";cart.setAttribute("aria-label","Cart");
    cart.innerHTML='<span class="customer-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h2l1.3 9.2a2 2 0 0 0 2 1.8h7.7a2 2 0 0 0 2-1.8L20 8H7"></path><circle cx="10" cy="19" r="1.4"></circle><circle cx="18" cy="19" r="1.4"></circle></svg></span><span class="customer-action-label">'+(cartCount()>0?"Cart ("+cartCount()+")":"Cart")+'</span>';
    actions.appendChild(cart);
  }
}
function syncMobileAccount(){
  const a=document.getElementById("ccMobileAccountLink");
  if(!a)return;
  const loggedIn=!!(customerUser&&customerProfile);
  a.href=loggedIn?"account.html?v=3.80":"customer-login.html";
  a.setAttribute("aria-label",loggedIn?"My Account":"Login");
  const label=a.querySelector(".cc-mobile-account-label");if(label)label.textContent=loggedIn?"Account":"Login";
}
function injectMobileBar(){
  let bar=document.getElementById("ccMobileBar");
  if(!bar){
    bar=document.createElement("nav");
    bar.id="ccMobileBar";
    bar.className="cc-mobile-bar";
    bar.setAttribute("aria-label","Mobile navigation");
    bar.innerHTML='<a href="index.html" data-mobile-nav="home"><span class="cc-mobile-icon">⌂</span><span>Home</span></a>'+
      '<a href="products.html" data-mobile-nav="products"><span class="cc-mobile-icon">▦</span><span>Products</span></a>'+
      '<a href="checkout.html" data-mobile-nav="cart"><span class="cc-mobile-icon">🛒</span><b class="cc-mobile-cart-badge hidden" id="ccMobileCartBadge">0</b><span>Cart</span></a>'+
      '<a href="customer-login.html" data-mobile-nav="account" id="ccMobileAccountLink"><span class="cc-mobile-icon">◯</span><span class="cc-mobile-account-label">Login</span></a>';
    document.body.appendChild(bar);
  }
  const path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  bar.querySelectorAll("[data-mobile-nav]").forEach(a=>{
    const key=a.getAttribute("data-mobile-nav");
    const active=(key==="home"&&path==="index.html")||(key==="products"&&path==="products.html")||(key==="cart"&&path==="checkout.html")||(key==="account"&&(path==="account.html"||path==="customer-login.html"||path==="customer-signup.html"));
    a.classList.toggle("active",active);
  });
  syncMobileAccount();
  const badge=document.getElementById("ccMobileCartBadge");
  const count=cartCount();
  if(badge){badge.textContent=count>99?"99+":String(count);badge.classList.toggle("hidden",count===0);}
}
function toastSite(message){
  let el=document.getElementById("ccToast");
  if(!el){
    el=document.createElement("div");el.id="ccToast";el.className="cc-toast";document.body.appendChild(el);
  }
  el.textContent=message;el.classList.add("show");
  clearTimeout(window.__ccToastTimer);window.__ccToastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}

function showCustomerView(name){
  closeCart();
  const map={login:"ccLoginView",signup:"ccSignupView",account:"ccAccountView",order:"ccOrderView"};  Object.entries(map).forEach(([key,id])=>document.getElementById(id)?.classList.toggle("hidden",key!==name));
  const auth=name==="login"||name==="signup";
  document.getElementById("ccAuthHead")?.classList.toggle("hidden",!auth);
  document.getElementById("ccAuthTabs")?.classList.toggle("hidden",!auth);
  document.getElementById("ccTabLogin")?.classList.toggle("active",name==="login");
  document.getElementById("ccTabSignup")?.classList.toggle("active",name==="signup");
}

function openCustomerPanel(view="login",startOrder=false){
  closeCart();
  const layer=document.getElementById("ccCustomerLayer");
  if(!layer)return;
  layer.classList.remove("hidden");
  document.body.classList.add("cc-modal-open");
  if(view==="account"&&customerUser){
    renderAccount();
    showCustomerView("account");
    if(startOrder){
      if(pendingOrderProduct)showOrderForm(pendingOrderProduct);
      else if(publicProducts[0])showOrderForm(publicProducts[0]);
    }
  }else{
    showCustomerView(view==="signup"?"signup":"login");
  }
}

function closeCustomerPanel(){
  const layer=document.getElementById("ccCustomerLayer");
  if(layer)layer.classList.add("hidden");
  document.body.classList.remove("cc-modal-open");
}

function switchToOrderAfterLogin(){
  if(customerUser&&pendingOrderProduct)showOrderForm(pendingOrderProduct);
}

async function loginCustomer(e){
  e.preventDefault();
  const status=document.getElementById("ccLoginStatus");
  status.textContent="";
  const identifier=normalizeSitePhone(document.getElementById("ccLoginIdentifier").value);
  const password=document.getElementById("ccLoginPassword").value;
  if(!phoneRE.test(identifier)){status.textContent="Enter your 10-digit mobile number.";return;}
  if(!password){status.textContent="Enter your password.";return;}

  const {data,error}=await invokeCustomerAuth({action:"login",identifier,password});
  if(error){reportSiteError(error,{action:"customer_login"});status.textContent=error.message||"Unable to login right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Login failed. Please try again.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){reportSiteError(setError,{action:"customer_set_session"});status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
  try{await siteDb.from("customers").update({customer_source:customerSourceFromLocation()}).eq("auth_user_id",customerUser.id);}catch(_){}
  customerProfile=null;
  await loadCustomerProfile();
  document.getElementById("ccLoginForm").reset();
  window.location.href=getSafeNext();
}

async function signupCustomer(e){
  e.preventDefault();
  const status=document.getElementById("ccSignupStatus");
  status.textContent="";
  const phone=normalizeSitePhone(document.getElementById("ccSignupPhone").value);
  if(!phoneRE.test(phone)){status.textContent="Enter a valid 10-digit mobile number.";return;}
  const email="";
  const password=document.getElementById("ccSignupPassword").value;
  if(password.length<8){status.textContent="Password must be at least 8 characters.";return;}

  const {data,error}=await invokeCustomerAuth({action:"signup",phone,email,password});
  if(error){reportSiteError(error,{action:"customer_signup"});status.textContent=error.message||"Unable to create account right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Account created, but login could not be started. Please login.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
  try{await siteDb.from("customers").update({customer_source:customerSourceFromLocation()}).eq("auth_user_id",customerUser.id);}catch(_){}
  customerProfile=null;
  await loadCustomerProfile();
  document.getElementById("ccSignupForm").reset();
  window.location.href=getSafeNext();
}

async function loadCustomerProfile(){
  if(!customerUser)return;
  const {data,error}=await siteDb.from("customers")
    .select("id,name,phone,business_name,email,gstin,billing_address,delivery_address,delivery_state,delivery_city,delivery_pincode,alternate_phone,auth_user_id,customer_source,archived_at")
    .eq("auth_user_id",customerUser.id).is("archived_at",null).maybeSingle();
  if(error)reportSiteError(error,{action:"customer_profile_load"});
  customerProfile=error?null:data;
  renderCustomerNav();
}

function syncHomeCustomerCard(){
  const card=document.querySelector(".home-account-actions");
  if(!card)return;
  const loggedIn=!!customerUser;
  card.classList.toggle("hidden",loggedIn);
  card.setAttribute("aria-hidden",String(loggedIn));
}
function renderCustomerNav(){
  const a=document.getElementById("ccCustomerLink");
  if(a){
    const loggedIn=!!(customerUser&&customerProfile);
    a.href=loggedIn?"account.html?v=3.7.15":"customer-login.html";
    a.setAttribute("aria-label",loggedIn?"My Account":"Login");
    const label=a.querySelector(".customer-action-label");
    if(label)label.textContent=loggedIn?"My Account":"Login";
  }
  renderCartCount();
  syncHomeCustomerCard();
}
function renderAccount(){
  document.getElementById("ccAccountName").textContent=customerProfile?.phone||"Customer account";
  const bits=[customerProfile?.email||"Email not added",customerProfile?.phone].filter(Boolean);
  document.getElementById("ccAccountMeta").textContent=bits.join(" • ");
  document.getElementById("ccOrdersPanel").innerHTML="";
}

async function loadCustomerOrders(showPanel=true){
  if(!customerUser)return;
  const panel=document.getElementById("ccOrdersPanel");
  if(panel)panel.innerHTML='<div class="cc-loading">Loading your orders…</div>';
  const {data,error}=await siteDb.from("website_orders")
    .select("id,order_no,status,total,notes,created_at")
    .eq("customer_id",customerProfile.id)
    .order("created_at",{ascending:false});
  if(error){if(panel)panel.innerHTML='<p class="cc-status">Unable to load orders right now.</p>';return;}
  const rows=(data||[]).map(o=>'<div class="cc-order-row"><div><strong>'+escSite(o.order_no)+'</strong><span>'+new Date(o.created_at).toLocaleString("en-IN")+'</span></div><div><b>'+siteMoney(o.total)+'</b><span class="cc-status-pill">'+escSite(o.status)+'</span></div></div>').join("");
  if(panel)panel.innerHTML='<h3>My orders</h3>'+(rows||'<p class="cc-muted">No orders yet.</p>');
  if(showPanel){showCustomerView("account");document.getElementById("ccOrdersPanel").scrollIntoView({block:"nearest"});}
}

function openOrder(product){
  if(!product)return;
  addToCart(product,1);
  toastSite(product.name+" added to cart");
  // Add to Cart never opens authentication. Login is requested only at checkout.
}

function showOrderForm(product){
  if(product)addToCart(product,1);
  openCart();
}

function updateOrderTotal(){
  document.getElementById("ccOrderTotal").textContent="Order total: "+siteMoney(cartSubtotal());
}

async function placeCustomerOrder(e){
  e.preventDefault();
  if(!customerUser||!customerProfile||!customerCart.length)return;
  const status=document.getElementById("ccOrderStatus");
  status.textContent="Placing order…";
  const name=document.getElementById("ccCustomerName").value.trim();
  const email=document.getElementById("ccCustomerEmail").value.trim();
  const alternate=document.getElementById("ccAlternatePhone").value.trim();
  const address=document.getElementById("ccOrderNotes").value.trim();
    if(!validSiteEmail(email)){status.textContent="Enter a valid email address.";return}
  if(alternate&&!phoneRE.test(normalizeSitePhone(alternate))){status.textContent="Enter a valid 10-digit alternate number.";return;}
  if(!address){status.textContent="Enter your delivery address.";return;}
  status.textContent="Saving your details…";
  const {data:profileData,error:profileError}=await siteDb.rpc("update_website_customer_profile",{
    p_name:name,p_email:email,p_alternate_phone:normalizeSitePhone(alternate),p_delivery_address:address
  });
  if(profileError){reportSiteError(profileError,{action:"customer_profile_update"});status.textContent=profileError.message;return;}
  customerProfile={...customerProfile,...(profileData||{})};
  status.textContent="Placing order…";
  const {data,error}=await siteDb.rpc("place_website_cart_order",{
    p_items:customerCart.map(x=>({product_id:x.product_id,quantity:Number(x.quantity)})),
    p_notes:address
  });
  if(error){status.textContent=error.message;return;}
  const order=data||{};
  customerCart=[];
  saveCustomerCart();
  await loadCustomerOrders(false);
  document.getElementById("ccOrdersPanel").innerHTML='<div class="cc-success">Order placed successfully. Order number: <strong>'+escSite(order.order_no)+'</strong> • Total: <strong>'+siteMoney(order.total)+'</strong></div>';
  showCustomerView("account");
}

function checkoutGstValues(){
  const enabled=!!document.getElementById("checkoutGstEnabled")?.checked;
  const rate=enabled?28:0;
  const total=cartSubtotal();
  const gst=enabled?Number((total*rate/(100+rate)).toFixed(2)):0;
  const taxable=enabled?Number((total-gst).toFixed(2)):total;
  const state=String(document.getElementById("checkoutState")?.value||"").trim().toLowerCase();
  const intra=state.replace(/[^a-z]/g,"")==="telangana";
  const cgst=intra?Number((gst/2).toFixed(2)):0;
  const sgst=intra?Number((gst-cgst).toFixed(2)):0;
  const igst=intra?0:gst;
  return {enabled,rate,total,taxable,gst,cgst,sgst,igst,state};
}
function renderCheckoutTax(){
  const box=document.getElementById("checkoutTaxBreakdown");
  const total=document.getElementById("checkoutTotal");
  if(!box||!total)return;
  const x=checkoutGstValues();
  total.textContent=siteMoney(x.total);
  if(!x.enabled){box.innerHTML="";return;}
  const rows=x.intra
    ? "<div><span>Taxable value</span><b>"+siteMoney(x.taxable)+"</b></div><div><span>CGST ("+x.rate/2+"%)</span><b>"+siteMoney(x.cgst)+"</b></div><div><span>SGST ("+x.rate/2+"%)</span><b>"+siteMoney(x.sgst)+"</b></div>"
    : "<div><span>Taxable value</span><b>"+siteMoney(x.taxable)+"</b></div><div><span>IGST ("+x.rate+"%)</span><b>"+siteMoney(x.igst)+"</b></div>";
  box.innerHTML=rows+"<div><span>GST included in total</span><b>"+siteMoney(x.gst)+"</b></div>";
}

window.initCleanCoreCheckout=async function(){
  if(!location.pathname.toLowerCase().includes("checkout.html"))return;
  const empty=document.getElementById("checkoutEmpty");
  const auth=document.getElementById("checkoutAuthRequired");
  const content=document.getElementById("checkoutContent");
  const success=document.getElementById("checkoutSuccess");
  if(!empty||!auth||!content)return;
  if(success&&!success.classList.contains("hidden"))return;

  // Always resolve the current persisted Supabase session here. The inline
  // page call can happen before onAuthStateChange has populated customerUser.
  if(!customerUser&&siteDb){
    try{
      const {data}=await siteDb.auth.getSession();
      customerUser=data?.session?.user||null;
      if(customerUser&&!customerProfile)await loadCustomerProfile();
    }catch(err){
      reportSiteError(err,{action:"checkout_session_init"});
    }
  }
  customerCart=loadCustomerCart();
  const items=customerCart;
  if(!items.length){
    empty.classList.remove("hidden");auth.classList.add("hidden");content.classList.add("hidden");return;
  }
  if(!customerUser){
    auth.classList.remove("hidden");empty.classList.add("hidden");content.classList.add("hidden");
    document.getElementById("checkoutLoginBtn").onclick=()=>{window.location.href="customer-login.html?next=checkout.html";};
    return;
  }
  auth.classList.add("hidden");empty.classList.add("hidden");content.classList.remove("hidden");
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??"";};
  set("checkoutName",/^Customer\s+\d{10}$/.test(String(customerProfile?.name||""))?"":customerProfile?.name);set("checkoutPhone",customerProfile?.phone?String(customerProfile.phone):"");
  set("checkoutEmail",customerProfile?.email);
  set("checkoutAlternate",customerProfile?.alternate_phone);
  const addr=String(customerProfile?.delivery_address||"");
  const parts=addr.split(" | ");
  set("checkoutHouse",parts[0]||"");set("checkoutStreet",parts[1]||"");set("checkoutCity",parts[2]||"");
  set("checkoutState",parts[3]||"");set("checkoutPincode",parts[4]||"");set("checkoutLandmark",parts[5]||"");
  set("checkoutGstin",customerProfile?.gstin||"");
  set("checkoutBusinessName",customerProfile?.business_name||"");
  set("checkoutBillingAddress",customerProfile?.billing_address||"");
  const gstToggle=document.getElementById("checkoutGstEnabled");
  const gstFields=document.getElementById("checkoutGstFields");
  const syncGstFields=()=>{const on=!!gstToggle?.checked;gstFields?.classList.toggle("hidden",!on);renderCheckoutTax();};
  if(gstToggle&&!gstToggle.dataset.bound){
    gstToggle.dataset.bound="1";
    gstToggle.addEventListener("change",syncGstFields);
    document.getElementById("checkoutGstin")?.addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/\s/g,"").slice(0,15));
    document.getElementById("checkoutState")?.addEventListener("input",renderCheckoutTax);
  }
  gstFields?.classList.toggle("hidden",!gstToggle?.checked);
  customerCart=items;
  const sync=await refreshCheckoutCartPrices();
  if(!customerCart.length){empty.classList.remove("hidden");auth.classList.add("hidden");content.classList.add("hidden");return;}
  renderCheckoutItems();renderCheckoutTax();
  if(sync.removed){const status=document.getElementById("checkoutStatus");if(status)status.textContent="One or more unavailable items were removed from your cart.";}
  const form=document.getElementById("checkoutForm");
  if(form.dataset.bound==="1")return;
  form.dataset.bound="1";
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const status=document.getElementById("checkoutStatus"),btn=document.getElementById("checkoutPlaceBtn");
    const name=document.getElementById("checkoutName").value.trim(),email=document.getElementById("checkoutEmail").value.trim();
    const alternate=normalizeSitePhone(document.getElementById("checkoutAlternate").value.trim());
    const house=document.getElementById("checkoutHouse").value.trim(),street=document.getElementById("checkoutStreet").value.trim();
    const city=document.getElementById("checkoutCity").value.trim(),state=document.getElementById("checkoutState").value.trim();
    const pincode=document.getElementById("checkoutPincode").value.trim(),landmark=document.getElementById("checkoutLandmark").value.trim();
    const gstEnabled=!!document.getElementById("checkoutGstEnabled")?.checked;
    const gstin=document.getElementById("checkoutGstin")?.value.trim().toUpperCase()||"";
    const businessName=document.getElementById("checkoutBusinessName")?.value.trim()||"";
    const billingAddress=document.getElementById("checkoutBillingAddress")?.value.trim()||"";
    const gstRate=gstEnabled?28:0;
    const address=[house,street,city,state,pincode,landmark].join(" | ");
    if(!name){status.textContent="Enter your full name.";return;}
    if(!validSiteEmail(email)){status.textContent="Enter a valid email address.";return;}
    if(alternate&&!phoneRE.test(alternate)){status.textContent="Enter a valid 10-digit alternate number.";return;}
    if(!house||!street||!city||!state||!/^[0-9]{6}$/.test(pincode)){status.textContent="Complete your delivery address and enter a valid 6-digit pincode.";return;}
    if(gstEnabled&&!/^[0-9A-Z]{15}$/.test(gstin)){status.textContent="Enter a valid 15-character GSTIN.";return;}
    if(gstEnabled&&!businessName){status.textContent="Enter your business name for the GST invoice.";return;}
    if(gstEnabled&&!billingAddress){status.textContent="Enter your full billing address for the GST invoice.";return;}
    btn.disabled=true;status.textContent="Saving details and placing order…";
    const {data:profile,error:profileError}=await siteDb.rpc("update_website_customer_profile",{p_name:name,p_email:email,p_alternate_phone:alternate,p_delivery_address:address,p_business_name:businessName,p_billing_address:billingAddress,p_gstin:gstEnabled?gstin:""});
    if(profileError){reportSiteError(profileError,{action:"checkout_profile_update"});btn.disabled=false;status.textContent=profileError.message;return;}
    customerProfile={...customerProfile,...(profile||{})};
    const currentItems=loadCustomerCart();
    if(!currentItems.length){btn.disabled=false;status.textContent="Your cart is empty.";return;}
    const {data:order,error}=await siteDb.rpc("place_website_cart_order",{
      p_items:currentItems.map(x=>({product_id:x.product_id,quantity:Number(x.quantity)})),
      p_notes:address,p_gst_enabled:gstEnabled,p_gst_rate:gstRate,p_gstin:gstin
    });
    if(error){btn.disabled=false;status.textContent=error.message;return;}
    customerCart=[];saveCustomerCart();
    empty.classList.add("hidden");auth.classList.add("hidden");content.classList.add("hidden");
    document.querySelector(".checkout-title")?.classList.add("hidden");

    // Checkout ends on a confirmation screen only. The invoice is intentionally
    // not rendered here; customers download it later from My Account > My Orders.
    const placedAt=order?.placed_at?new Date(order.placed_at):new Date();
    let successItems=[];
    if(order?.id){
      const ir=await siteDb.from("website_order_items")
        .select("product_name,unit,qty,unit_price,line_total")
        .eq("order_id",order.id).order("created_at");
      if(!ir.error)successItems=ir.data||[];
    }
    const successRows=successItems.length
      ? successItems.map(it=>'<div class="cc-success-product"><div><strong>'+escSite(it.product_name||"Product")+'</strong><span>'+escSite(it.unit||"")+'</span></div><div><span>Qty: '+escSite(it.qty??"—")+'</span><b>'+siteMoney(it.line_total)+'</b></div></div>').join("")
      : '<div class="cc-success-product"><div><strong>Order items</strong><span>See My Orders for full details</span></div></div>';

    // Render confirmation into the existing checkout DOM instead of replacing <body>.
    // This keeps mobile CSS, header controls, and delegated click handlers intact.
    if(success){
      success.className="cc-order-success-only";
      success.innerHTML='<section class="cc-order-success-card" aria-labelledby="ccSuccessTitle">'+
        '<div class="cc-success-icon" aria-hidden="true">✓</div>'+
        '<div class="cc-success-eyebrow">CLEANCORE ORDER CONFIRMATION</div>'+
        '<h1 id="ccSuccessTitle">Order placed successfully!</h1>'+
        '<p class="cc-success-lead">Thank you for your order. Your order has been received and our team will process it shortly.</p>'+
        '<div class="cc-success-order-id"><span>Order ID</span><strong>'+escSite(order?.order_no||order?.id||"—")+'</strong></div>'+
        '<div class="cc-success-meta"><div><span>Order date</span><b>'+escSite(placedAt.toLocaleString("en-IN"))+'</b></div><div><span>Status</span><b>'+escSite(order?.status||"New")+'</b></div><div><span>Total</span><b>'+siteMoney(order?.total)+'</b></div></div>'+
        '<div class="cc-success-section"><div class="cc-success-section-head"><div><span class="cc-success-kicker">YOUR ORDER</span><h2>Product details</h2></div><span>'+successItems.length+' item'+(successItems.length===1?"":"s")+'</span></div><div class="cc-success-products">'+successRows+'</div><div class="cc-success-total"><span>Order total</span><strong>'+siteMoney(order?.total)+'</strong></div></div>'+
        '<div class="cc-success-message"><div class="cc-success-message-icon" aria-hidden="true">i</div><div><strong>A message from CleanCore</strong><p>Thank you for choosing CleanCore Chemical & Cleaning. We have received your order and will process it shortly. You can view your order anytime from My Account and download your invoice PDF from My Orders.</p></div></div>'+
        '<div class="cc-success-actions" role="group" aria-label="Order actions"><a class="btn btn-primary cc-success-nav" data-success-nav="account.html?v=invoice-pdf-v4" href="account.html?v=invoice-pdf-v4">Go to My Account</a><a class="btn btn-secondary cc-success-nav" data-success-nav="products.html" href="products.html">Continue shopping</a></div>'+
      '</section>';
      success.classList.remove("hidden");
      success.scrollIntoView({block:"start",behavior:"auto"});
    }
    document.querySelectorAll("[data-success-nav]").forEach(a=>{
      a.addEventListener("click",e=>{
        e.preventDefault();
        const href=a.getAttribute("data-success-nav");
        if(href)window.location.assign(href);
      },{passive:false});
    });
    document.querySelectorAll("[data-success-nav]").forEach(a=>{
      a.addEventListener("click",e=>{
        e.preventDefault();
        const href=a.getAttribute("data-success-nav");
        if(href)window.location.assign(href);
      },{passive:false});
    });
    btn.disabled=false;
  });
};


function logoutCustomer(){
  siteDb.auth.signOut({scope:"local"}).finally(()=>{
    customerUser=null;customerProfile=null;pendingOrderProduct=null;renderCustomerNav();closeCustomerPanel();
  });
}

function bindCustomerAuth(){
  if(!siteDb)return;
  siteDb.auth.onAuthStateChange(async(_event,session)=>{
    customerUser=session?.user||null;
    if(customerUser)await loadCustomerProfile();else{customerProfile=null;renderCustomerNav();syncHomeCustomerCard();}
    if(location.pathname.toLowerCase().includes("checkout.html")) window.initCleanCoreCheckout?.();
  });
  siteDb.auth.getSession().then(async({data})=>{
    customerUser=data.session?.user||null;
    if(customerUser)await loadCustomerProfile();else renderCustomerNav();
    if(location.pathname.toLowerCase().includes("checkout.html")) await window.initCleanCoreCheckout?.();
  });
}

document.addEventListener("click",e=>{
  const inc=e.target.closest?.("[data-cart-inc]");
  const dec=e.target.closest?.("[data-cart-dec]");
  const rem=e.target.closest?.("[data-cart-remove]");
  const cinc=e.target.closest?.("[data-checkout-inc]");
  const cdec=e.target.closest?.("[data-checkout-dec]");
  const crem=e.target.closest?.("[data-checkout-remove]");
  if(inc){updateCartQuantity(inc.dataset.cartInc,1);return;}
  if(dec){updateCartQuantity(dec.dataset.cartDec,-1);return;}
  if(rem){removeCartItem(rem.dataset.cartRemove);return;}
  if(cinc){updateCartQuantity(cinc.dataset.checkoutInc,1);return;}
  if(cdec){updateCartQuantity(cdec.dataset.checkoutDec,-1);return;}
  if(crem){removeCartItem(crem.dataset.checkoutRemove);renderCheckoutItems();return;}
  const btn=e.target.closest?.(".order-now");
  if(btn){
    e.preventDefault();
    if(btn.disabled)return;
    const id=btn.dataset.productId;
    const product=id?publicProducts.find(p=>p.id===id):publicProducts.find(p=>p.name===btn.dataset.productName);
    if(product)openOrder(product);
    return;
  }
  const card=e.target.closest?.(".product-link[data-product-url]");
  if(card){
    e.preventDefault();
    window.location.href=card.dataset.productUrl;
  }
});
document.addEventListener("input",e=>{});

document.addEventListener("DOMContentLoaded",()=>{
  void flushSiteErrorQueue();
  injectCustomerUI();
  bindSharedMenu();
  setCleanCoreActiveNav();
  injectMobileBar();
  injectEnquiryWidget();
  loadPublicProducts();
  populateEnquiryProducts();
  bindWebsiteEnquiry();
  bindCustomerAuth();
  renderCartCount();
  if(location.pathname.toLowerCase().includes("checkout.html")) void window.initCleanCoreCheckout?.();
});
document.addEventListener("error",e=>{
 const t=e.target;
 if(t && (t.tagName==="IMG"||t.tagName==="SCRIPT"||t.tagName==="LINK")){
   reportSiteError(new Error("Failed to load "+t.tagName.toLowerCase()+": "+(t.src||t.href||"")),{
     action:"resource_load_error",
     context:{resource:t.src||t.href||"",tag:t.tagName}
   });
 }
},true);


/* CleanCore 4D interaction layer — pointer depth on capable devices only */
(function(){
  const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine=window.matchMedia&&window.matchMedia("(pointer:fine)").matches;
  if(reduce||!fine)return;
  if(document.body.classList.contains("auth-flat"))return;
  const selector=".product,.box,.contact-card,.request-form,.checkout-card,.checkout-notice,.hero-card,.home-range,.home-account-actions,.home-catalog-cta,.home-proof-item";
  let last=null;
  const reset=el=>{
    if(!el)return;
    el.style.removeProperty("--cc-rx");
    el.style.removeProperty("--cc-ry");
    el.classList.add("cc-tilt-reset");
    window.setTimeout(()=>el.classList.remove("cc-tilt-reset","cc-tilt-active"),360);
  };
  document.addEventListener("pointermove",function(e){
    const el=e.target.closest?.(selector);
    if(last&&last!==el)reset(last);
    last=el;
    if(!el)return;
    const r=el.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const x=(e.clientX-r.left)/r.width-.5;
    const y=(e.clientY-r.top)/r.height-.5;
    const rx=(-y*3.2).toFixed(2),ry=(x*3.8).toFixed(2);
    el.classList.add("cc-tilt-active");
    el.style.setProperty("--cc-rx",rx+"deg");
    el.style.setProperty("--cc-ry",ry+"deg");
  },{passive:true});
  document.addEventListener("pointerleave",function(){reset(last);last=null},{passive:true});
  document.addEventListener("mouseout",function(e){
    if(!last)return;
    const to=e.relatedTarget;
    if(!to||!last.contains(to)){reset(last);last=null}
  },{passive:true});
})();
