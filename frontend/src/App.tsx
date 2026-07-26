import { useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function testHelloWorld() {
    try {
      setLoading(true)
      setMessage('')

      console.log('Invocando hello-world...')

      const { data, error } = await supabase.functions.invoke(
        'hello-world',
        {
          body: {
            name: 'Oriol',
          },
        },
      )

      if (error) {
        console.error('Error al ejecutar la función:', error)
        setMessage(`Error: ${error.message}`)
        return
      }

      console.log('Respuesta de hello-world:', data)

      setMessage(data?.message ?? 'Respuesta recibida')
    } catch (error) {
      console.error('Error inesperado:', error)
      setMessage('Ocurrió un error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Prueba de Supabase Edge Function</h1>

      <button
        type="button"
        onClick={testHelloWorld}
        disabled={loading}
      >
        {loading ? 'Ejecutando...' : 'Ejecutar hello-world'}
      </button>

      {message && <p>{message}</p>}
    </main>
  )
}

export default App