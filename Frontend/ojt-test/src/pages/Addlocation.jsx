import { useState } from "react";
import api from "../services/api";

function AddLocation() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [image, setImage] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!image) {
      setError("Please select a JPG image.");
      return;
    }

    const formData = new FormData();

    formData.append("name", name);
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("image", image);

    try {
      const response = await api.post(
        "/locations/",
        formData
      );

      console.log(response.data);

      setMessage("Location uploaded successfully!");

      setName("");
      setDescription("");
      setLatitude("");
      setLongitude("");
      setImage(null);

    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.detail ||
        "Failed to upload location."
      );
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">
        Add Location
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl space-y-4"
      >
        <div>
          <label className="mb-1 block font-medium">
            Location Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Description
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Latitude
          </label>

          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Longitude
          </label>

          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            JPG Image
          </label>

          <input
            type="file"
            accept=".jpg,.jpeg"
            onChange={(e) => setImage(e.target.files[0])}
            required
          />
        </div>

        {message && (
          <p className="text-green-600">
            {message}
          </p>
        )}

        {error && (
          <p className="text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Submit Location
        </button>
      </form>
    </div>
  );
}

export default AddLocation;