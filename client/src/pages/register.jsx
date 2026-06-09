import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/register", {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
      });

      alert("Registration Successful!");
      console.log(response.data);
      navigate("/"); 

    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.message ||
        "Registration Failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased text-slate-800">
      <div className="bg-white w-full max-w-[450px] p-10 rounded-lg border border-slate-200 shadow-md flex flex-col text-center">
        
        {/* Title Section */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <svg
            className="w-7 h-7 text-slate-800"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M19 12V19H5V5H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 9L11 5L2 14V22H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 11V16H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="17.5" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="2"/>
            <path d="M17.5 4.5V8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M15.5 6.5H19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h2 className="text-lg font-bold text-slate-800 tracking-wide m-0">
            SMART BUDGET ANALYZER - REGISTER
          </h2>
        </div>

        <p className="text-sm text-slate-500 m-0 mb-6">
          Create an account to start tracking your finances.
        </p>

        {/* Form Elements */}
        <form onSubmit={handleSubmit} className="text-left flex flex-col gap-4">

          {/* Full Name Field */}
          <div className="flex flex-col">
            <label htmlFor="fullName" className="text-xs font-semibold text-slate-600 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="e.g., Jane Doe"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md box-border placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-slate-900"
            />
          </div>

          {/* Email Field */}
          <div className="flex flex-col">
            <label htmlFor="email" className="text-xs font-semibold text-slate-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="e.g., jane.doe@email.com"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md box-border placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-slate-900"
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col">
            <label htmlFor="password" className="text-xs font-semibold text-slate-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter a strong password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md box-border placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-slate-900"
            />
          </div>

          {/* Confirm Password Field */}
          <div className="flex flex-col">
            <label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-600 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength="8"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md box-border placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-slate-900"
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 text-sm font-semibold text-white bg-blue-600 rounded-md cursor-pointer hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? "REGISTERING..." : "REGISTER"}
          </button>

        </form>

        {/* Footer Redirect String */}
        <p className="text-xs text-slate-500 mt-6 m-0">
          Already have an account?{" "}
          <span 
            onClick={() => navigate("/")} 
            className="text-blue-600 font-semibold cursor-pointer hover:underline"
          >
            Login here.
          </span>
        </p>

      </div>
    </div>
  );
}

export default Register;