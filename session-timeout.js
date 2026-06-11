async function startSessionTimeout() {

  try {

    const res = await fetch(
      "http://localhost:5000/api/admin/settings"
    );

    const data = await res.json();

    if (!data.success) return;

    const timeoutMinutes =
      data.settings.session_timeout || 30;

    let inactivityTimer;

    function resetTimer() {

      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {

        await Swal.fire({
  title: "Session Expired",
  text: "Your session has expired. Please login again.",
  icon: "warning",
  confirmButtonText: "OK",
  allowOutsideClick: false,
  allowEscapeKey: false,
  customClass: {
    popup: "jcn-popup",
    title: "jcn-title",
    confirmButton: "jcn-confirm-btn"
  },
  buttonsStyling: false
});

localStorage.removeItem("adminToken");
localStorage.removeItem("adminUser");

window.location.href = "admin-login.html";;

      }, timeoutMinutes * 60 * 1000);

    }

    document.addEventListener(
      "mousemove",
      resetTimer
    );

    document.addEventListener(
      "keypress",
      resetTimer
    );

    document.addEventListener(
      "click",
      resetTimer
    );

    resetTimer();

  } catch (err) {
    console.error(err);
  }
}

startSessionTimeout();