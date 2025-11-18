"""
Parameter conversion utilities for web API
"""


def web_to_internal_params(params_web, param_names):
    """Convert parameters from web format to internal circuit format.

    Web format has CPE parameters as separate Q and n values.
    Internal format has CPE parameters as tuples (Q, n).

    Args:
        params_web (dict): Parameters in web format
        param_names (list): List of parameter names

    Returns:
        dict: Parameters in internal format
    """
    params = {}
    i = 0
    while i < len(param_names):
        key = param_names[i]
        if key.endswith("_n"):
            # Skip _n parameters, they're handled with Q parameters
            i += 1
            continue
        if key.endswith("_B"):
            # Warburg Short/Open B parameter
            i += 1
        elif key[0] == "Q":
            # CPE parameter - combine Q and n
            q_value = float(params_web[key])
            n_key = f"{key}_n"
            n_value = float(params_web.get(n_key, 0.9))
            params[key] = (q_value, n_value)
            i += 1
        elif key[0] == "S" or key[0] == "O":
            # Warburg Short/Open parameters - combine Aw and B
            aw_value = float(params_web[key])
            b_key = f"{key}_B"
            b_value = float(params_web[b_key])
            params[key] = (aw_value, b_value)
            i += 1
        else:
            params[key] = float(params_web[key])
            i += 1
    return params


def internal_to_web_params(params_internal):
    """Convert parameters from internal circuit format to web format.

    Internal format has CPE parameters as tuples (Q, n).
    Web format has CPE parameters as separate Q and Q_n values.

    Args:
        params_internal (dict): Parameters in internal format

    Returns:
        dict: Parameters in web format
    """
    params_web = {}
    for key, val in params_internal.items():
        if isinstance(val, tuple):
            # CPE parameter - unpack tuple
            if key[0] == "Q":
                params_web[f"{key}_n"] = float(val[1])
            elif key[0] == "S" or key[0] == "O":
                params_web[f"{key}_B"] = float(val[1])
            params_web[key] = float(val[0])
        else:
            params_web[key] = float(val)
    return params_web
