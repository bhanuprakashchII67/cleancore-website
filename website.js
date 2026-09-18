const SUPABASE_URL="https://rwfamxkfqslorxcryjrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_tzfe2xVn6OAwF-Mh5_u_zQ_a_bAW7tO";
const siteDb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const escSite=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const waPhone="919182725773";

async function loadPublicProducts(){
  if(!siteDb)return;
  const {data,error}=await siteDb.from("website_products").select("id,name,unit,selling_price,description,additional_details,image_urls,video_urls,active").eq("active",true).order("name");
  if(error||!Array.isArray(data)||!data.length)return;
  const grids=document.querySelectorAll(".product-grid");
  grids.forEach((grid,index)=>{
    const list=(location.pathname.toLowerCase().includes("products.html")||index>0)?data:data.slice(0,4);
    grid.innerHTML=list.map(p=>{
      const img=Array.isArray(p.image_urls)?p.image_urls[0]:"";
      const art=img
        ? '<div class="imgbox"><img class="prod-img" src="'+escSite(img)+'" alt="'+escSite(p.name)+'"></div>'
        : '<div class="imgbox product-placeholder"><div>'+escSite(String(p.name||"").trim().charAt(0).toUpperCase())+'</div></div>';
      const msg="Hello CleanCore, I want to order "+p.name+" - "+p.unit+" at Rs "+p.selling_price+".";
      return '<article class="product">'+art+'<div class="product-body"><span class="tag">'+escSite(p.unit)+'</span><h3>'+escSite(p.name)+'</h3><p>'+escSite(p.description||"Cleaning product for professional business use.")+'</p><div class="price">₹'+Number(p.selling_price||0).toFixed(2)+' <small>/ '+escSite(p.unit)+'</small></div><a class="btn btn-primary" href="https://wa.me/'+waPhone+'?text='+encodeURIComponent(msg)+'">Order on WhatsApp</a></div></article>';
    }).join("");
  });
}

function populateEnquiryProducts(){
  const select=document.getElementById("websiteProduct");
  if(!select||!siteDb)return;
  siteDb.from("website_products").select("id,name,unit,selling_price,active").eq("active",true).order("name").then(({data})=>{
    if(!Array.isArray(data))return;
    select.innerHTML='<option value="">Select product</option>'+data.map(p=>'<option value="'+escSite(p.name)+'">'+escSite(p.name)+' — ₹'+Number(p.selling_price||0).toFixed(2)+' / '+escSite(p.unit)+'</option>').join("");
  });
}
function bindWebsiteEnquiry(){
  const form=document.getElementById("websiteEnquiryForm");
  if(!form||!siteDb)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const msg=document.getElementById("websiteEnquiryStatus");
    const phone=document.getElementById("websitePhone").value.replace(/\D/g,"").slice(0,10);
    if(!/^[6-9]\d{9}$/.test(phone)){msg.textContent="Enter a valid 10-digit mobile number.";return;}
    const product=document.getElementById("websiteProduct").value;
    const quantity=Number(document.getElementById("websiteQuantity").value||0);
    const payload={
      name:document.getElementById("websiteName").value.trim(),
      phone,
      business:document.getElementById("websiteBusiness").value.trim(),
      email:document.getElementById("websiteEmail").value.trim(),
      product_name:product||null,
      quantity:quantity>0?quantity:null,
      message:document.getElementById("websiteMessage").value.trim(),
      source:"website",
      status:"New"
    };
    if(!payload.name){msg.textContent="Enter your name.";return;}
    const {error}=await siteDb.from("enquiries").insert(payload);
    if(error){msg.textContent="Unable to send right now. Please WhatsApp or call us.";return;}
    form.reset();
    msg.textContent="Request sent. CleanCore will contact you.";
  });
}
document.addEventListener("DOMContentLoaded",()=>{
  loadPublicProducts();
  populateEnquiryProducts();
  bindWebsiteEnquiry();
});
