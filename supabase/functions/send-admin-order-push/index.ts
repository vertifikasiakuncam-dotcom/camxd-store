import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("CAMXD_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("CAMXD_VAPID_PRIVATE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CAMXD_ORDER_WEBHOOK_SECRET")!;

webpush.setVapidDetails(
  "https://vertifikasiakuncam-dotcom.github.io/camxd-store/",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase=createClient(SUPABASE_URL,SERVICE_ROLE);

Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("Method Not Allowed",{status:405});
  if(req.headers.get("x-camxd-webhook-secret")!==WEBHOOK_SECRET)
    return new Response("Unauthorized",{status:401});

  const payload=await req.json();
  const order=payload.record || payload;
  if(!order?.id) return new Response("No order record",{status:400});

  const {data:subs,error}=await supabase
    .from("admin_push_subscriptions")
    .select("id,subscription");
  if(error) return Response.json({error:error.message},{status:500});

  const items=Array.isArray(order.items)?order.items:[];
  const productText=items.slice(0,2).map((x:any)=>x.name || "Produk").join(", ");
  const total=Number(order.total||0).toLocaleString("id-ID");
  const message={
    title:"CAMXD STORE",
    body:"🛒 Pesanan Baru • "+(order.order_id||"Order")+"\n"+
      (order.customer_name||"Pelanggan")+" • "+productText+" • Rp "+total,
    tag:"camxd-order-"+String(order.id),
    url:"./admin.html?app=camxd-admin"
  };

  let sent=0,removed=0;
  for(const row of subs || []){
    try{
      await webpush.sendNotification(row.subscription,JSON.stringify(message));
      sent++;
    }catch(err:any){
      const status=err?.statusCode;
      if(status===404 || status===410){
        await supabase.from("admin_push_subscriptions").delete().eq("id",row.id);
        removed++;
      }else{
        console.error("Push failed",row.id,err);
      }
    }
  }
  return Response.json({ok:true,sent,removed});
});
