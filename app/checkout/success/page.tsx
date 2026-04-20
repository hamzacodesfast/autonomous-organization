export default function CheckoutSuccessPage() {
  return (
    <section className="section policy">
      <p className="eyebrow">Checkout Return</p>
      <h1>Payment Is Being Confirmed</h1>
      <p>
        Stripe returned the browser to the Organization. Allocation is confirmed only after the server receives
        Stripe&apos;s signed payment event and updates the order record.
      </p>
      <p>Support: autonomousorganization@protonmail.com</p>
    </section>
  );
}
