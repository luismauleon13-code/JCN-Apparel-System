// Small helper for customer-checkout.js after /api/orders succeeds.
// Linking must be checked before redirecting to PayPal.
window.JCNLinkCustomDesigns = async function(orderId, items) {
  const requestIds=[...new Set((items||[]).map(x=>x.custom_design_request_id).filter(Boolean))];
  if(!requestIds.length)return {success:true,linked:0};
  if(!orderId)throw new Error('Order ID missing. Design reference cannot be linked.');
  const response=await fetch('http://localhost:5000/api/customer/customization/link-order',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('customerToken')||'')},
    body:JSON.stringify({order_id:orderId,request_ids:requestIds})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw new Error(data.message||'Unable to link the custom design to this order. Contact staff; do not pay twice.');
  return data;
};
