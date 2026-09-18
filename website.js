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

function siteMoney(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));}

async function invokeCustomerAuth(body){
  try{
    const result=await siteDb.functions.invoke("customer-auth",{body});
    if(!result.error)return result;
    let message=result.error.message||"Unable to complete the request.";
    try{
      const ctx=result.error.context;
      if(ctx){
        const clone=ctx.clone?ctx.clone():ctx;
        const payload=await clone.json();
        if(payload?.error)message=payload.error;
      }
    }catch(_){}
    return {data:null,error:{message}};
  }catch(e){
    return {data:null,error:{message:e?.message||"Unable to complete the request."}};
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
      return '<article class="product">'+art+'<div class="product-body"><span class="tag">'+escSite(p.unit)+'</span><h3>'+escSite(p.name)+'</h3><p>'+escSite(p.description||"Cleaning product for professional business use.")+'</p><div class="price">'+siteMoney(p.selling_price)+' <small>/ '+escSite(p.unit)+'</small></div><button type="button" class="btn btn-primary order-now" data-product-id="'+escSite(p.id)+'">Order Now</button></div></article>';
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
  if(document.getElementById("ccCustomerLayer"))return;

  const nav=document.getElementById("navMenu");
  if(nav&&!document.getElementById("ccCustomerLink")){
    const a=document.createElement("a");
    a.id="ccCustomerLink";
    a.href="#";
    a.className="customer-nav-link";
    a.textContent="Login";
    a.addEventListener("click",e=>{e.preventDefault();openCustomerPanel(customerUser?"account":"login");});
    nav.appendChild(a);
  }

  const layer=document.createElement("div");
  layer.id="ccCustomerLayer";
  layer.className="cc-layer hidden";
  layer.innerHTML=`
    <div class="cc-modal cc-auth-modal" role="dialog" aria-modal="true" aria-labelledby="ccModalTitle">
      <button type="button" class="cc-close" id="ccClose" aria-label="Close">×</button>

      <div id="ccAuthHead" class="cc-auth-head">
        <div class="cc-auth-icon">CC</div>
        <div>
          <div class="cc-eyebrow">Customer account</div>
          <div class="cc-auth-sub">Secure access to your CleanCore orders</div>
        </div>
      </div>

      <div id="ccAuthTabs" class="cc-auth-tabs" role="tablist" aria-label="Customer account">
        <button type="button" id="ccTabLogin" class="cc-auth-tab active" role="tab">Login</button>
        <button type="button" id="ccTabSignup" class="cc-auth-tab" role="tab">Create account</button>
      </div>

      <div id="ccLoginView" class="cc-view">
        <h2 id="ccModalTitle">Welcome back</h2>
        <p class="cc-muted">Use your phone number or email with your password.</p>
        <form id="ccLoginForm">
          <label>Phone number or email
            <input id="ccLoginIdentifier" type="text" inputmode="email" autocomplete="username" placeholder="9876543210 or you@example.com" required>
          </label>
          <label>Password
            <input id="ccLoginPassword" type="password" autocomplete="current-password" placeholder="Your password" required>
          </label>
          <p id="ccLoginStatus" class="cc-status" aria-live="polite"></p>
          <button class="btn btn-primary cc-wide cc-main-action" type="submit"><span>Login</span><span aria-hidden="true">→</span></button>
        </form>
      </div>

      <div id="ccSignupView" class="cc-view hidden">
        <h2>Create your account</h2>
        <p class="cc-muted">Phone number is required. Email is optional.</p>
        <form id="ccSignupForm">
          <label>Phone number
            <input id="ccSignupPhone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="10-digit mobile number" required>
          </label>
          <label>Email <span class="cc-optional">(optional)</span>
            <input id="ccSignupEmail" type="email" autocomplete="email" placeholder="you@example.com">
          </label>
          <label>Password
            <input id="ccSignupPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Create a password" required>
          </label>
          <p id="ccSignupStatus" class="cc-status" aria-live="polite"></p>
          <button class="btn btn-primary cc-wide cc-main-action" type="submit"><span>Create account</span><span aria-hidden="true">→</span></button>
        </form>
      </div>

      <div id="ccAccountView" class="cc-view hidden">
        <div class="cc-eyebrow">My account</div>
        <h2 id="ccAccountName">Customer account</h2>
        <p id="ccAccountMeta" class="cc-muted"></p>
        <div class="cc-account-actions">
          <button type="button" id="ccAccountOrder" class="btn btn-primary">Order now</button>
          <button type="button" id="ccAccountOrders" class="btn btn-secondary">My orders</button>
          <button type="button" id="ccAccountLogout" class="btn">Logout</button>
        </div>
        <div id="ccOrdersPanel"></div>
      </div>

      <div id="ccOrderView" class="cc-view hidden">
        <div class="cc-eyebrow">Place order</div>
        <h2>Order Now</h2>
        <div class="cc-product-summary">
          <div><strong id="ccOrderProductName"></strong><span id="ccOrderProductMeta"></span></div>
          <strong id="ccOrderPrice"></strong>
        </div>
        <form id="ccOrderForm">
          <label>Quantity<input id="ccOrderQuantity" type="number" min="1" step="1" value="1" required></label>
          <label>Delivery / order note<textarea id="ccOrderNotes" rows="3" placeholder="Delivery address or any special instruction"></textarea></label>
          <p id="ccOrderTotal" class="cc-order-total"></p>
          <p id="ccOrderStatus" class="cc-status" aria-live="polite"></p>
          <div class="cc-account-actions"><button type="button" id="ccOrderBack" class="btn">Back</button><button class="btn btn-primary" type="submit">Place Order</button></div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(layer);

  document.getElementById("ccClose").onclick=closeCustomerPanel;
  layer.addEventListener("click",e=>{if(e.target===layer)closeCustomerPanel();});
  document.getElementById("ccTabLogin").onclick=()=>openCustomerPanel("login");
  document.getElementById("ccTabSignup").onclick=()=>openCustomerPanel("signup");
  document.getElementById("ccLoginForm").addEventListener("submit",loginCustomer);
  document.getElementById("ccSignupForm").addEventListener("submit",signupCustomer);
  document.getElementById("ccAccountOrder").onclick=()=>openCustomerPanel("account",true);
  document.getElementById("ccAccountOrders").onclick=()=>loadCustomerOrders(true);
  document.getElementById("ccAccountLogout").onclick=logoutCustomer;
  document.getElementById("ccOrderBack").onclick=()=>openCustomerPanel("account");
  document.getElementById("ccOrderForm").addEventListener("submit",placeCustomerOrder);
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
  const map={login:"ccLoginView",signup:"ccSignupView",account:"ccAccountView",order:"ccOrderView"};
  Object.entries(map).forEach(([key,id])=>document.getElementById(id)?.classList.toggle("hidden",key!==name));
  const auth=name==="login"||name==="signup";
  document.getElementById("ccAuthHead")?.classList.toggle("hidden",!auth);
  document.getElementById("ccAuthTabs")?.classList.toggle("hidden",!auth);
  document.getElementById("ccTabLogin")?.classList.toggle("active",name==="login");
  document.getElementById("ccTabSignup")?.classList.toggle("active",name==="signup");
}

function openCustomerPanel(view="login",startOrder=false){
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
  const identifier=document.getElementById("ccLoginIdentifier").value.trim();
  const password=document.getElementById("ccLoginPassword").value;
  if(!identifier||!password){status.textContent="Enter your phone number/email and password.";return;}

  const {data,error}=await invokeCustomerAuth({action:"login",identifier,password});
  if(error){status.textContent=error.message||"Unable to login right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Login failed. Please try again.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
  customerProfile=data.customer||null;
  document.getElementById("ccLoginForm").reset();
  renderCustomerNav();renderAccount();switchToOrderAfterLogin();
  if(!pendingOrderProduct)showCustomerView("account");
}

async function signupCustomer(e){
  e.preventDefault();
  const status=document.getElementById("ccSignupStatus");
  status.textContent="";
  const phone=normalizeSitePhone(document.getElementById("ccSignupPhone").value);
  if(!phoneRE.test(phone)){status.textContent="Enter a valid 10-digit mobile number.";return;}
  const email=document.getElementById("ccSignupEmail").value.trim();
  const password=document.getElementById("ccSignupPassword").value;
  if(password.length<8){status.textContent="Password must be at least 8 characters.";return;}

  const {data,error}=await invokeCustomerAuth({action:"signup",phone,email,password});
  if(error){status.textContent=error.message||"Unable to create account right now.";return;}
  if(data?.error){status.textContent=data.error;return;}
  if(!data?.session){status.textContent="Account created, but login could not be started. Please login.";return;}

  const {error:setError}=await siteDb.auth.setSession(data.session);
  if(setError){status.textContent=setError.message;return;}
  customerUser=data.user||data.session.user;
  customerProfile=data.customer||null;
  document.getElementById("ccSignupForm").reset();
  renderCustomerNav();renderAccount();switchToOrderAfterLogin();
  if(!pendingOrderProduct)showCustomerView("account");
}

async function loadCustomerProfile(){
  if(!customerUser)return;
  const {data,error}=await siteDb.from("customers")
    .select("id,name,phone,business_name,email,gstin,billing_address,delivery_address,auth_user_id")
    .eq("auth_user_id",customerUser.id).maybeSingle();
  customerProfile=error?null:data;
  renderCustomerNav();
}

function renderCustomerNav(){
  const a=document.getElementById("ccCustomerLink");
  if(a)a.textContent=customerUser&&customerProfile?"My Account":"Login";
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
  pendingOrderProduct=product;
  if(!customerUser||!customerProfile){
    openCustomerPanel("login");
    document.getElementById("ccLoginStatus").textContent="Login with your phone number or email to place this order.";
    return;
  }
  openCustomerPanel("account");
  showOrderForm(product);
}

function showOrderForm(product){
  if(!product)return;
  pendingOrderProduct=product;
  document.getElementById("ccOrderProductName").textContent=product.name;
  document.getElementById("ccOrderProductMeta").textContent=product.unit;
  document.getElementById("ccOrderPrice").textContent=siteMoney(product.selling_price);
  document.getElementById("ccOrderQuantity").value=1;
  document.getElementById("ccOrderNotes").value=customerProfile?.delivery_address||"";
  document.getElementById("ccOrderStatus").textContent="";
  updateOrderTotal();
  showCustomerView("order");
}

function updateOrderTotal(){
  const q=Math.max(1,Number(document.getElementById("ccOrderQuantity")?.value||1));
  const p=pendingOrderProduct;
  if(p)document.getElementById("ccOrderTotal").textContent="Order total: "+siteMoney(Number(p.selling_price||0)*q);
}

async function placeCustomerOrder(e){
  e.preventDefault();
  if(!customerUser||!customerProfile||!pendingOrderProduct)return;
  const status=document.getElementById("ccOrderStatus");
  const qty=Number(document.getElementById("ccOrderQuantity").value||0);
  if(!Number.isInteger(qty)||qty<1){status.textContent="Enter a valid quantity.";return;}
  status.textContent="Placing order…";
  const {data,error}=await siteDb.rpc("place_website_order",{
    p_product_id:pendingOrderProduct.id,
    p_quantity:qty,
    p_notes:document.getElementById("ccOrderNotes").value.trim()
  });
  if(error){status.textContent=error.message;return;}
  const order=data||{};
  pendingOrderProduct=null;
  await loadCustomerOrders(false);
  document.getElementById("ccOrdersPanel").insertAdjacentHTML("afterbegin",'<div class="cc-success">Order placed successfully. Order number: <strong>'+escSite(order.order_no)+'</strong> • Total: <strong>'+siteMoney(order.total)+'</strong></div>');
  showCustomerView("account");
}

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
  });
  siteDb.auth.getSession().then(async({data})=>{
    customerUser=data.session?.user||null;
    if(customerUser)await loadCustomerProfile();else renderCustomerNav();
  });
}

document.addEventListener("click",e=>{
  const btn=e.target.closest?.(".order-now");
  if(btn){
    e.preventDefault();
    const id=btn.dataset.productId;
    const product=id?publicProducts.find(p=>p.id===id):publicProducts.find(p=>p.name===btn.dataset.productName);
    if(product)openOrder(product);
  }
});
document.addEventListener("input",e=>{if(e.target?.id==="ccOrderQuantity")updateOrderTotal();});

document.addEventListener("DOMContentLoaded",()=>{
  injectCustomerUI();
  loadPublicProducts();
  populateEnquiryProducts();
  bindWebsiteEnquiry();
  bindCustomerAuth();
});
