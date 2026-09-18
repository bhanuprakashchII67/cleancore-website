const SUPABASE_URL="https://rwfamxkfqslorxcryjrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_tzfe2xVn6OAwF-Mh5_u_zQ_a_bAW7tO";
const siteDb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const escSite=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const waPhone="919182725773";
const phoneRE=/^[6-9]\d{9}$/;
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
  const a=document.getElementById("ccCartLink");
  if(a)a.textContent=cartCount()>0?"Cart ("+cartCount()+")":"Cart";
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
function openCart(){
  const layer=document.getElementById("ccCustomerLayer");
  const modal=document.getElementById("ccAuthModal");
  const drawer=document.getElementById("ccCartDrawer");
  if(!layer||!drawer)return;
  layer.classList.remove("hidden");
  document.body.classList.add("cc-modal-open");
  modal?.classList.add("hidden");
  drawer.classList.remove("hidden");
  renderCart();
}
function closeCart(){
  document.getElementById("ccCartDrawer")?.classList.add("hidden");
  document.getElementById("ccAuthModal")?.classList.remove("hidden");
}
function showCheckout(){
  window.location.href="checkout.html";
  return;
  if(!customerUser){
    window.location.href="login.html?next=checkout.html";
    return;
  }
  if(!customerCart.length){renderCart();return;}
  if(!customerProfile){
    loadCustomerProfile().then(()=>{
      if(customerProfile)showCheckout();
      else {closeCart();openCustomerPanel("login");}
    });
    return;
  }
  closeCart();
  showCustomerView("order");
  fillCheckoutCustomer();
  renderCheckoutSummary();
}
function fillCheckoutCustomer(){
  document.getElementById("ccCustomerName").value=customerProfile?.name==="Customer"?"":(customerProfile?.name||"");
  document.getElementById("ccCustomerEmail").value=customerProfile?.email||"";
  document.getElementById("ccAlternatePhone").value=customerProfile?.alternate_phone||"";
  document.getElementById("ccOrderNotes").value=customerProfile?.delivery_address||"";
}
function getSafeNext(){
  const next=new URLSearchParams(location.search).get("next")||"index.html";
  return next==="checkout.html"||next==="account.html"||next==="index.html"?"./"+next:"./index.html";
}
async function refreshCheckoutCartPrices(){
  const ids=[...new Set(customerCart.map(x=>x.product_id))];
  if(!ids.length)return {removed:0};
  const {data,error}=await siteDb.from("website_products").select("id,name,unit,selling_price,active").in("id",ids).eq("active",true);
  if(error||!Array.isArray(data))return {removed:0};
  const products=new Map(data.map(p=>[p.id,p]));
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
function normalizeSitePhone(v){return String(v||"").replace(/\D/g,"").replace(/^91/,"");}

async function loadPublicProducts(){
  if(!siteDb)return;
  const {data,error}=await siteDb.from("website_products")
    .select("id,name,unit,selling_price,description,additional_details,image_urls,video_urls,active")
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
      const priceMarkup=location.pathname.toLowerCase().includes("products.html")?'<div class="price">'+siteMoney(p.selling_price)+' <small>/ '+escSite(p.unit)+'</small></div>':"";
      return '<article class="product">'+art+'<div class="product-body"><span class="tag">'+escSite(p.unit)+'</span><h3>'+escSite(p.name)+'</h3><p>'+escSite(p.description||"Cleaning product for professional business use.")+'</p>'+priceMarkup+'<button type="button" class="btn btn-primary order-now" data-product-id="'+escSite(p.id)+'">Add to Cart</button></div></article>';
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
    const {error}=await siteDb.from("enquiries").insert(payload);
    if(error){msg.textContent="Unable to send right now. Please use the order form or contact CleanCore.";return;}
    form.reset();
    msg.textContent="Request sent. CleanCore will contact you.";
  });
}

function injectCustomerUI(){
  const nav=document.getElementById("navMenu");
  if(!nav)return;

  if(!document.getElementById("ccCustomerLink")){
    const a=document.createElement("a");
    a.id="ccCustomerLink";
    a.href=customerUser?"account.html":"login.html";
    a.className="customer-nav-link";
    a.textContent=customerUser?"My Account":"Login";
    nav.appendChild(a);
  }

  if(!document.getElementById("ccCartLink")){
    const cart=document.createElement("a");
    cart.id="ccCartLink";
    cart.href="checkout.html";
    cart.className="customer-nav-link cc-cart-link";
    cart.textContent=cartCount()>0?"Cart ("+cartCount()+")":"Cart";
    nav.appendChild(cart);
  }
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
  const map={login:"ccLoginView",signup:"ccSignupView",account:"ccAccountView",order:"ccOrderView"};
  Object.entries(map).forEach(([key,id])=>document.getElementById(id)?.classList.toggle("hidden",key!==name));
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
  if(error){status.textContent=error.message||"Unable to login right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Login failed. Please try again.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
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
  if(error){status.textContent=error.message||"Unable to create account right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Account created, but login could not be started. Please login.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
  customerProfile=null;
  await loadCustomerProfile();
  document.getElementById("ccSignupForm").reset();
  window.location.href=getSafeNext();
}

async function loadCustomerProfile(){
  if(!customerUser)return;
  const {data,error}=await siteDb.from("customers")
    .select("id,name,phone,business_name,email,gstin,billing_address,delivery_address,alternate_phone,auth_user_id")
    .eq("auth_user_id",customerUser.id).maybeSingle();
  customerProfile=error?null:data;
  renderCustomerNav();
}

function renderCustomerNav(){
  const a=document.getElementById("ccCustomerLink");
  if(a){
    a.textContent=customerUser&&customerProfile?"My Account":"Login";
    a.href=customerUser&&customerProfile?"account.html":"login.html";
  }
  renderCartCount();
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
  if(!name){status.textContent="Enter your full name.";return;}
  if(email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){status.textContent="Enter a valid email address.";return;}
  if(alternate&&!phoneRE.test(normalizeSitePhone(alternate))){status.textContent="Enter a valid 10-digit alternate number.";return;}
  if(!address){status.textContent="Enter your delivery address.";return;}
  status.textContent="Saving your details…";
  const {data:profileData,error:profileError}=await siteDb.rpc("update_website_customer_profile",{
    p_name:name,p_email:email,p_alternate_phone:normalizeSitePhone(alternate),p_delivery_address:address
  });
  if(profileError){status.textContent=profileError.message;return;}
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

window.initCleanCoreCheckout=async function(){
  if(!location.pathname.toLowerCase().includes("checkout.html"))return;
  const empty=document.getElementById("checkoutEmpty");
  const auth=document.getElementById("checkoutAuthRequired");
  const content=document.getElementById("checkoutContent");
  if(!empty||!auth||!content)return;
  customerCart=loadCustomerCart();
  const items=customerCart;
  if(!items.length){
    empty.classList.remove("hidden");auth.classList.add("hidden");content.classList.add("hidden");return;
  }
  if(!customerUser){
    auth.classList.remove("hidden");empty.classList.add("hidden");content.classList.add("hidden");
    document.getElementById("checkoutLoginBtn").onclick=()=>{
      window.location.href="login.html?next=checkout.html";
    };
    return;
  }
  auth.classList.add("hidden");empty.classList.add("hidden");content.classList.remove("hidden");
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??"";};
  set("checkoutName",/^Customer\s+\d{10}$/.test(String(customerProfile?.name||""))?"":customerProfile?.name);
  set("checkoutEmail",customerProfile?.email);
  set("checkoutAlternate",customerProfile?.alternate_phone);
  const addr=String(customerProfile?.delivery_address||"");
  const parts=addr.split(" | ");
  set("checkoutHouse",parts[0]||"");
  set("checkoutStreet",parts[1]||"");
  set("checkoutCity",parts[2]||"");
  set("checkoutState",parts[3]||"");
  set("checkoutPincode",parts[4]||"");
  set("checkoutLandmark",parts[5]||"");
  customerCart=items;
  const sync=await refreshCheckoutCartPrices();
  if(!customerCart.length){
    empty.classList.remove("hidden");auth.classList.add("hidden");content.classList.add("hidden");
    return;
  }
  renderCheckoutItems();
  if(sync.removed){ 
    const status=document.getElementById("checkoutStatus");
    if(status)status.textContent="One or more unavailable items were removed from your cart.";
  }
  const form=document.getElementById("checkoutForm");
  if(form.dataset.bound==="1")return;
  form.dataset.bound="1";
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const status=document.getElementById("checkoutStatus"),btn=document.getElementById("checkoutPlaceBtn");
    const name=document.getElementById("checkoutName").value.trim();
    const email=document.getElementById("checkoutEmail").value.trim();
    const alternate=normalizeSitePhone(document.getElementById("checkoutAlternate").value.trim());
    const house=document.getElementById("checkoutHouse").value.trim();
    const street=document.getElementById("checkoutStreet").value.trim();
    const city=document.getElementById("checkoutCity").value.trim();
    const state=document.getElementById("checkoutState").value.trim();
    const pincode=document.getElementById("checkoutPincode").value.trim();
    const landmark=document.getElementById("checkoutLandmark").value.trim();
    const address=[house,street,city,state,pincode,landmark].join(" | ");
    if(!name){status.textContent="Enter your full name.";return;}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent="Enter a valid email address.";return;}
    if(alternate&&!phoneRE.test(alternate)){status.textContent="Enter a valid 10-digit alternate number.";return;}
    if(!house||!street||!city||!state||!/^[0-9]{6}$/.test(pincode)){status.textContent="Complete your delivery address and enter a valid 6-digit pincode.";return;}
    btn.disabled=true;status.textContent="Saving details and placing order…";
    const {data:profile,error:profileError}=await siteDb.rpc("update_website_customer_profile",{p_name:name,p_email:email,p_alternate_phone:alternate,p_delivery_address:address});
    if(profileError){btn.disabled=false;status.textContent=profileError.message;return;}
    customerProfile={...customerProfile,...(profile||{})};
    const currentItems=loadCustomerCart();
    if(!currentItems.length){btn.disabled=false;status.textContent="Your cart is empty.";return;}
    const {data:order,error}=await siteDb.rpc("place_website_cart_order",{p_items:currentItems.map(x=>({product_id:x.product_id,quantity:Number(x.quantity)})),p_notes:address});
    if(error){btn.disabled=false;status.textContent=error.message;return;}
    customerCart=[];saveCustomerCart();
    document.getElementById("checkoutContent").classList.add("hidden");
    const success=document.getElementById("checkoutSuccess");
    success.classList.remove("hidden");
    success.innerHTML='<div class="cc-success"><h2>Order placed successfully</h2><p>Order number: <strong>'+escSite(order?.order_no)+'</strong></p><p>Total: <strong>'+siteMoney(order?.total)+'</strong></p><a class="btn btn-primary" href="index.html">Continue shopping</a></div>';
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
    if(customerUser)await loadCustomerProfile();else{customerProfile=null;renderCustomerNav();}
    if(location.pathname.toLowerCase().includes("checkout.html")) window.initCleanCoreCheckout?.();
  });
  siteDb.auth.getSession().then(async({data})=>{
    customerUser=data.session?.user||null;
    if(customerUser)await loadCustomerProfile();else renderCustomerNav();
    if(location.pathname.toLowerCase().includes("checkout.html")) window.initCleanCoreCheckout?.();
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
    const id=btn.dataset.productId;
    const product=id?publicProducts.find(p=>p.id===id):publicProducts.find(p=>p.name===btn.dataset.productName);
    if(product)openOrder(product);
  }
});
document.addEventListener("input",e=>{});

document.addEventListener("DOMContentLoaded",()=>{
  injectCustomerUI();
  loadPublicProducts();
  populateEnquiryProducts();
  bindWebsiteEnquiry();
  bindCustomerAuth();
  renderCartCount();
});
