require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'Imagenes';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/state', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_state')
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ success: false, error: error.message });
    }

    const appState = data?.value ? JSON.parse(data.value) : null;
    return res.json({ success: true, appState });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/state', async (req, res) => {
  try {
    const { appState } = req.body;
    if (!appState) {
      return res.status(400).json({ success: false, error: 'Missing appState' });
    }

    const payload = {
      key: 'app_state',
      value: JSON.stringify(appState),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'key' });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

const WORK_DAYS_FALLBACK_KEY = 'work_days_fallback';

async function getFallbackWorkDays() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', WORK_DAYS_FALLBACK_KEY)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.value || [];
}

async function saveFallbackWorkDays(workDays) {
  const payload = {
    key: WORK_DAYS_FALLBACK_KEY,
    value: workDays,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' });

  if (error) {
    throw error;
  }

  return workDays;
}

function isSchemaError(error) {
  return error?.code === 'PGRST204' || error?.code === 'PGRST205';
}

function isWorkDayInsertError(error) {
  return isSchemaError(error) || error?.code === '23503' || error?.code === '22P02';
}

app.post('/upload-image', async (req, res) => {
  try {
    const { fileName, fileBase64, bucket, contentType } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, error: 'fileName and fileBase64 are required' });
    }

    const targetBucket = bucket || STORAGE_BUCKET;
    const key = `product-images/${Date.now()}-${fileName}`;
    const buffer = Buffer.from(fileBase64, 'base64');

    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(key, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ success: false, error: uploadError.message });
    }

    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(key);

    if (publicUrlError) {
      return res.status(500).json({ success: false, error: publicUrlError.message });
    }

    return res.json({ success: true, publicUrl: publicUrlData.publicUrl });
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

app.post('/products', async (req, res) => {
  try {
    const product = req.body;
    if (!product || !product.id || !product.name) {
      return res.status(400).json({ success: false, error: 'Missing product id or name' });
    }

    const payload = {
      id: product.id,
      sku: product.sku || null,
      name: product.name,
      description: product.description || null,
      type: product.type || 'other',
      price_bs: product.priceBs || 0,
      stock: product.stock || 0,
      iva_enabled: !!product.ivaEnabled,
      is_active: product.isActive !== false,
      image_url: product.imageUrl || null,
      image_storage_path: product.imageStoragePath || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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

app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body;
    if (!product || !product.name) {
      return res.status(400).json({ success: false, error: 'Missing product data' });
    }

    const payload = {
      sku: product.sku || null,
      name: product.name,
      description: product.description || null,
      type: product.type || 'other',
      price_bs: product.priceBs || 0,
      stock: product.stock || 0,
      iva_enabled: !!product.ivaEnabled,
      is_active: product.isActive !== false,
      image_url: product.imageUrl || null,
      image_storage_path: product.imageStoragePath || null,
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

app.get('/work_days', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_days')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, workDays: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/work_days', async (req, res) => {
  try {
    const day = req.body;
    if (!day || !day.id || !day.date) {
      return res.status(400).json({ success: false, error: 'Missing work day id or date' });
    }

    const payload = {
      id: day.id,
      date: day.date,
      status: day.status || 'open',
      sales: day.sales || [],
      expenses: day.expenses || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('work_days')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, workDay: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/work_days/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const day = req.body;
    if (!day) {
      return res.status(400).json({ success: false, error: 'Missing work day data' });
    }

    const payload = {
      date: day.date,
      status: day.status || 'open',
      sales: day.sales || [],
      expenses: day.expenses || [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('work_days')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, workDay: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/work_days/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = {
      status: 'closed',
      updated_at: new Date().toISOString(),
      closed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('work_days')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, workDay: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/work_days/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('work_days')
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

app.post('/send-report', async (req, res) => {
  const { emailConfig, reportData } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword
      }
    });

    const mailOptions = {
      from: emailConfig.fromAddress,
      to: emailConfig.toAddress,
      subject: 'Reporte de Ventas - Ronatug',
      text: `Reporte: ${JSON.stringify(reportData, null, 2)}`
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});