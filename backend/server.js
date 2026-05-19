require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '..')));

function sendUnauthorized(res) {
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res);
  }

  const accessToken = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    return sendUnauthorized(res);
  }

  req.user = data.user;
  next();
}

app.get('/config', (req, res) => {
  return res.json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
});

app.get('/profile', authenticateRequest, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.json({ success: true, profile: { id: req.user.id, email: req.user.email, full_name: null, role: 'user' } });
    }

    return res.json({ success: true, profile: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/profiles', authenticateRequest, async (req, res) => {
  try {
    const { full_name } = req.body;
    const payload = {
      id: req.user.id,
      email: req.user.email,
      full_name: full_name || null,
      role: 'user'
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, profile: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, products: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/products', authenticateRequest, async (req, res) => {
  try {
    const { name, description, price, stock, image_url } = req.body;
    if (!name || price == null || stock == null) {
      return res.status(400).json({ success: false, error: 'Missing required product data' });
    }

    const payload = {
      name: name.trim(),
      description: description || null,
      price: Number(price),
      stock: Number(stock),
      image_url: image_url || null
    };

    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, product: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/products/:id', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, image_url } = req.body;
    if (!name || price == null || stock == null) {
      return res.status(400).json({ success: false, error: 'Missing required product data' });
    }

    const payload = {
      name: name.trim(),
      description: description || null,
      price: Number(price),
      stock: Number(stock),
      image_url: image_url || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, product: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/products/:id', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/orders', authenticateRequest, async (req, res) => {
  try {
    const profileResponse = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isAdmin = profileResponse.data?.role === 'admin';
    const query = supabase
      .from('orders')
      .select('id, product_id, quantity, total, notes, created_at, products(name, price), profiles(full_name, email)');

    if (!isAdmin) {
      query.eq('user_id', req.user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, orders: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/orders', authenticateRequest, async (req, res) => {
  try {
    const { product_id, quantity, notes } = req.body;
    if (!product_id || quantity == null) {
      return res.status(400).json({ success: false, error: 'Missing product_id or quantity' });
    }

    const productResponse = await supabase
      .from('products')
      .select('id, name, price, stock')
      .eq('id', product_id)
      .single();

    if (productResponse.error || !productResponse.data) {
      return res.status(400).json({ success: false, error: 'Product not found' });
    }

    const product = productResponse.data;
    const orderQuantity = Number(quantity);
    const total = Number(product.price) * orderQuantity;
    const remainingStock = Math.max(0, Number(product.stock) - orderQuantity);

    const { data, error } = await supabase
      .from('orders')
      .insert({
        product_id,
        user_id: req.user.id,
        quantity: orderQuantity,
        total,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    await supabase
      .from('products')
      .update({ stock: remainingStock, updated_at: new Date().toISOString() })
      .eq('id', product_id);

    return res.json({ success: true, order: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/*path', (req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Supabase backend running on port ${PORT}`);
});
