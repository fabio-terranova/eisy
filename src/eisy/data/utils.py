from io import StringIO

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def nyquist_plot(Z_exp, Z_fit=None, freq=None, label=None):
    """Generate a Nyquist plot of experimental and fitted impedance data.

    Args:
        Z_exp (array): Array of experimental impedance values (complex numbers).
        Z_fit (array or list of arrays, optional): Single array or list of arrays of fitted impedance values (complex numbers). Defaults to None.
        freq (array, optional): Array of frequency values. Defaults to None.
        label (str or list of str, optional): Label or list of labels for the fitted data. Defaults to None.
    """
    plt.figure()
    plt.plot(Z_exp.real, -Z_exp.imag, "o", label="Experimental Data")

    if Z_fit is not None:
        if isinstance(Z_fit, list):
            for i, Zf in enumerate(Z_fit):
                lbl = (
                    label[i]
                    if label and isinstance(label, list) and i < len(label)
                    else f"Fitted Data {i + 1}"
                )
                plt.plot(Zf.real, -Zf.imag, "-", label=lbl)
        else:
            lbl = label if label and isinstance(label, str) else "Fitted Data"
            plt.plot(Z_fit.real, -Z_fit.imag, "-", label=lbl)

    if freq is not None:
        for i in range(0, len(freq), max(1, len(freq) // 10)):
            plt.text(Z_exp[i].real, -Z_exp[i].imag, f"{freq[i]:.1f}Hz")

    plt.xlabel("Z' (Ω)")
    plt.ylabel("-Z'' (Ω)")
    plt.title("Nyquist plot")
    plt.legend()
    plt.axis("equal")
    plt.grid()
    plt.show()


def bode_plot(freq, Z_exp, Z_fit=None):
    """Generate Bode plots of experimental and fitted impedance data.

    Args:
        freq (array): Array of frequency values.
        Z_exp (array): Array of experimental impedance values (complex numbers).
        Z_fit (array, optional): Array of fitted impedance values (complex numbers). Defaults to None.
    """
    plt.figure()

    # Magnitude plot
    plt.subplot(2, 1, 1)
    plt.loglog(freq, np.abs(Z_exp), "o", label="Experimental Data")

    if Z_fit is not None:
        plt.loglog(freq, np.abs(Z_fit), "-", label="Fitted Data")

    plt.ylabel("|Z| (Ω)")
    plt.title("Bode plot")
    plt.legend()
    plt.grid()

    # Phase plot
    plt.subplot(2, 1, 2)
    plt.semilogx(freq, np.angle(Z_exp, deg=True), "o", label="Experimental Data")

    if Z_fit is not None:
        plt.semilogx(freq, np.angle(Z_fit, deg=True), "-", label="Fitted Data")

    plt.xlabel("Frequency (Hz)")
    plt.ylabel("Phase (degrees)")
    plt.gca().invert_yaxis()
    plt.legend()
    plt.grid()

    plt.tight_layout()
    plt.show()


def readLCR6100(filepath: str) -> tuple:
    """
    Read impedance data from a Keithley LCR6100 measurement file.

    Args:
        filepath (str): Path to the LCR6100 measurement file.

    Returns:
        tuple: (frequency, Z_real, Z_imag) as numpy arrays.

    Raises:
        ValueError: If the file format is not recognized or data cannot be parsed.
    """
    try:
        with open(filepath, "r") as file:
            lines = file.readlines()
    except IOError as e:
        raise ValueError(f"Cannot read file {filepath}: {e}")

    # Find data section
    start_idx = None
    end_idx = None
    for i, line in enumerate(lines):
        if "**********List_Meas_Result**********" in line:
            start_idx = i + 1
        elif "**********END**********" in line and start_idx is not None:
            end_idx = i
            break

    if start_idx is None or end_idx is None:
        raise ValueError(
            "Invalid LCR-6100 file format: missing measurement section markers"
        )

    # Extract data lines
    data_lines = lines[start_idx:end_idx]
    data_str = "".join(data_lines)

    # Read the data into a pandas DataFrame
    df = pd.read_csv(StringIO(data_str), sep=r"\s+")

    # Drop rows where the impedance measurement overloaded
    df = df[df["Primary"] != "OVERLOAD"]

    # convert "Primary" and "Second" to numeric
    df["Primary"] = pd.to_numeric(df["Primary"])
    df["Second"] = pd.to_numeric(df["Second"])

    # convert "Primary" to Ohm based on "Unit.1"
    df.loc[df["Unit.1"] == "kohm", "Primary"] *= 1e3
    df.loc[df["Unit.1"] == "Mohm", "Primary"] *= 1e6
    df.loc[df["Unit.1"] == "ohm", "Primary"] *= 1

    # convert kHz to Hz
    df["Freq(kHz)"] *= 1e3

    # only maintain columns ["Freq_Value", "Primary", "Second"]
    df = df[["Freq(kHz)", "Primary", "Second"]]
    # rename columns
    df.columns = ["Freq(Hz)", "Z(Ohm)", "Theta(deg)"]

    # calculate complex impedance
    Z = df["Z(Ohm)"] * np.exp(1j * np.deg2rad(df["Theta(deg)"]))

    # return freq
    return df["Freq(Hz)"].to_numpy(), Z.to_numpy().real, Z.to_numpy().imag


def parse_data_file(file_content: str, filename: str = "") -> tuple:
    """
    Parse impedance data from various file formats.

    Supported formats:
    - Standard CSV/TXT: frequency, Z_real, Z_imag (comma/tab/space separated)
    - GW Instek LCR-6100: native measurement file format

    Args:
        file_content (str): Content of the file as a string.
        filename (str): Name of the file (used to detect format). Defaults to "".

    Returns:
        tuple: (frequency, Z_real, Z_imag) as numpy arrays.

    Raises:
        ValueError: If the file format is not recognized or data cannot be parsed.
    """
    # Check if it's an LCR6100 file
    if "**********List_Meas_Result**********" in file_content:
        import tempfile

        # Use BytesIO
        try:
            # Still need temp file for readLCR6100 compatibility
            with tempfile.NamedTemporaryFile(
                mode="w", delete=False, suffix=".txt", encoding="utf-8"
            ) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            freq, Z_real, Z_imag = readLCR6100(tmp_path)
            return freq, Z_real, Z_imag
        except Exception as e:
            raise ValueError(f"Failed to parse LCR-6100 file: {e}")
        finally:
            import os

            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # Try parsing as csv/txt with frequency, Z_real, Z_imag format
    delimiters_tried = []
    for sep in [",", "\t", r"\s+"]:
        try:
            df = pd.read_csv(
                StringIO(file_content),
                sep=sep,
                comment="#",
                header=None,
                skipinitialspace=True,
                on_bad_lines="skip",
                engine="python" if sep == r"\s+" else "c",
            )

            # Check if we got at least 3 columns and some data
            if df.shape[1] >= 3 and len(df) > 0:
                # Extract first three columns
                frequency = pd.to_numeric(df.iloc[:, 0], errors="coerce")
                impedance_real = pd.to_numeric(df.iloc[:, 1], errors="coerce")
                impedance_imag = pd.to_numeric(df.iloc[:, 2], errors="coerce")

                # Drop rows with NaN values
                valid_mask = ~(
                    frequency.isna() | impedance_real.isna() | impedance_imag.isna()
                )

                frequency = frequency[valid_mask]
                impedance_real = impedance_real[valid_mask]
                impedance_imag = impedance_imag[valid_mask]

                if len(frequency) > 0:
                    return (
                        frequency.to_numpy(),
                        impedance_real.to_numpy(),
                        impedance_imag.to_numpy(),
                    )

            delimiters_tried.append(sep.replace(r"\s+", "whitespace"))
        except Exception:
            delimiters_tried.append(sep.replace(r"\s+", "whitespace"))
            continue

    raise ValueError(
        f"Failed to parse file. Expected format: frequency, Z_real, Z_imag.\n"
        f"Tried delimiters: {', '.join(delimiters_tried)}.\n"
        f"Ensure the file has at least 3 columns of numeric data."
    )
