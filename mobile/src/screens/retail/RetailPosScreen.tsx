import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView
} from 'react-native'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { Camera } from 'expo-camera'
import { useOfflineStore } from '../../../stores/offlineStore'

interface Product {
  id: string
  name: string
  price: number
  barcode?: string
  stock: number
}

interface CartItem extends Product {
  quantity: number
}

const RetailPosScreen: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const { addPendingSync } = useOfflineStore()

  // Productos de ejemplo - en producción vendrían de SQLite local
  const [products] = useState<Product[]>([
    { id: '1', name: 'Coca Cola 600ml', price: 15.50, barcode: '123456789', stock: 50 },
    { id: '2', name: 'Papas Sabritas 45g', price: 12.00, barcode: '987654321', stock: 30 },
    { id: '3', name: 'Galletas Marías', price: 18.50, barcode: '456789123', stock: 25 },
    { id: '4', name: 'Leche Lala 1L', price: 22.00, barcode: '321654987', stock: 20 },
    { id: '5', name: 'Pan Bimbo', price: 35.00, barcode: '789456123', stock: 15 }
  ])

  useEffect(() => {
    ;(async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync()
      setHasPermission(status === 'granted')
    })()
  }, [])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.includes(searchTerm)
  )

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true)
    setShowCamera(false)
    
    const product = products.find(p => p.barcode === data)
    if (product) {
      addToCart(product)
    } else {
      Alert.alert('Producto no encontrado', `Código de barras: ${data}`)
    }
    
    setTimeout(() => setScanned(false), 2000)
  }

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id)
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + delta
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const processSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de procesar la venta')
      return
    }

    const saleData = {
      items: cart,
      total: getTotal(),
      timestamp: new Date().toISOString(),
      cashier: 'Usuario Móvil',
      deviceId: 'mobile-001'
    }

    // Guardar venta para sincronización offline
    addPendingSync({
      type: 'sale',
      action: 'create',
      data: saleData
    })

    // Limpiar carrito
    setCart([])
    setSearchTerm('')
    
    Alert.alert(
      'Venta Exitosa',
      `Total: $${getTotal().toFixed(2)}\nLa venta se sincronizará cuando haya conexión`,
      [{ text: 'OK' }]
    )
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Solicitando permiso para usar la cámara...</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No hay acceso a la cámara</Text>
      </View>
    )
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>Escanea el código de barras</Text>
        </View>
        <TouchableOpacity
          style={styles.closeCameraButton}
          onPress={() => setShowCamera(false)}
        >
          <Text style={styles.closeCameraText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Punto de Venta</Text>
        <Text style={styles.subtitle}>Carrito: {getTotalItems()} items</Text>
      </View>

      {/* Búsqueda y escáner */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setShowCamera(true)}
        >
          <Text style={styles.scanButtonText}>Escanear</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de productos */}
      <View style={styles.productsSection}>
        <Text style={styles.sectionTitle}>Productos</Text>
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productItem}
              onPress={() => addToCart(item)}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                <Text style={styles.productStock}>Stock: {item.stock}</Text>
              </View>
              <Text style={styles.addButton}>+</Text>
            </TouchableOpacity>
          )}
          scrollEnabled={false}
        />
      </View>

      {/* Carrito */}
      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Text style={styles.sectionTitle}>Carrito</Text>
          {cart.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <Text style={styles.cartItemPrice}>${item.price.toFixed(2)} c/u</Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, -1)}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromCart(item.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          <View style={styles.cartTotal}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>${getTotal().toFixed(2)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={processSale}
          >
            <Text style={styles.checkoutButtonText}>Procesar Venta</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 40
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white'
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 4
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white'
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginRight: 8
  },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center'
  },
  scanButtonText: {
    color: 'white',
    fontWeight: '600'
  },
  productsSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937'
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  productInfo: {
    flex: 1
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937'
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 2
  },
  productStock: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2
  },
  addButton: {
    fontSize: 24,
    color: '#2563eb',
    fontWeight: 'bold'
  },
  cartSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    padding: 16
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  cartItemInfo: {
    flex: 1
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937'
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#6b7280'
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  quantityButton: {
    width: 32,
    height: 32,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151'
  },
  quantityText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  removeButton: {
    marginLeft: 8,
    padding: 4
  },
  removeButtonText: {
    fontSize: 20,
    color: '#ef4444',
    fontWeight: 'bold'
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb'
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb'
  },
  checkoutButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 16
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black'
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 8
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center'
  },
  closeCameraButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8
  },
  closeCameraText: {
    color: 'white',
    fontSize: 16
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center'
  }
})

export default RetailPosScreen