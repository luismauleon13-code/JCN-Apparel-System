const inputs = document.querySelectorAll(".otp-inputs input");

inputs.forEach((input, index) => {

  input.addEventListener("input", () => {

    if (input.value.length === 1 && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }

  });

});

document.querySelector("form").addEventListener("submit", async (e) => {

  e.preventDefault();

  let otp = "";

  inputs.forEach(input => {
    otp += input.value;
  });

  const email = localStorage.getItem("verifyEmail");

  try {

    const response = await fetch("http://localhost:5000/api/auth/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp,
      }),
    });

    const data = await response.json();

    if (response.ok) {

      alert("Account verified successfully!");

      window.location.href = "login.html";

    } else {
      alert(data.message);
    }

  } catch (error) {
  console.error("REGISTER ERROR:", error);
  alert("Server error: " + error.message);
}
});